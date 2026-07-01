import { randomBytes } from "node:crypto"

import { and, asc, eq, gt, isNull, or, sql } from "drizzle-orm"

import { db } from "@/db"
import {
  workspaceDomains,
  workspaceInvites,
  workspaceMemberships,
  workspaces,
} from "@/db/schema"
import {
  AppError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/server/http/errors"
import { getOnboardingStateForUser } from "@/server/onboarding/service"
import { assertCanWorkspaceRole } from "@/server/policies/can"
import type { WorkspaceRole } from "@/server/policies/actions"
import { getWorkspaceForUserBySlug } from "@/server/workspaces/service"
import type { CreateInviteInput } from "@/server/invites/validation"

const INVITE_CODE_PREFIX = "FM"

function normalizeInviteCode(code: string) {
  return code.trim()
}

function createInviteCode() {
  return `${INVITE_CODE_PREFIX}-${randomBytes(12).toString("base64url")}`
}

function parseExpiresAt(expiresAt?: string | null) {
  if (!expiresAt) {
    return null
  }

  const date = new Date(expiresAt)

  if (Number.isNaN(date.getTime())) {
    throw new ValidationError("Enter a valid invite expiry date.", {
      expiresAt: ["Enter a valid invite expiry date."],
    })
  }

  if (date <= new Date()) {
    throw new ValidationError("Invite expiry must be in the future.", {
      expiresAt: ["Invite expiry must be in the future."],
    })
  }

  return date
}

function inviteSelectFields() {
  return {
    id: workspaceInvites.id,
    workspaceId: workspaceInvites.workspaceId,
    code: workspaceInvites.code,
    role: workspaceInvites.role,
    status: workspaceInvites.status,
    expiresAt: workspaceInvites.expiresAt,
    maxUses: workspaceInvites.maxUses,
    usedCount: workspaceInvites.usedCount,
    createdAt: workspaceInvites.createdAt,
    updatedAt: workspaceInvites.updatedAt,
  }
}

async function requireWorkspaceForInviteAction(
  userId: string,
  workspaceSlug: string
) {
  const workspace = await getWorkspaceForUserBySlug(userId, workspaceSlug)

  if (!workspace) {
    throw new NotFoundError("Workspace not found.")
  }

  assertCanWorkspaceRole(workspace.role, "workspace:create_invite")

  return workspace
}

async function ensureWorkspaceHasActiveDomain(workspaceId: string) {
  const [domain] = await db
    .select({ id: workspaceDomains.id })
    .from(workspaceDomains)
    .where(
      and(
        eq(workspaceDomains.workspaceId, workspaceId),
        eq(workspaceDomains.status, "active")
      )
    )
    .limit(1)

  if (!domain) {
    throw new ValidationError("Add at least one capture domain before inviting teammates.")
  }
}

export function buildInviteJoinPath(inviteCode: string) {
  return `/join/${encodeURIComponent(inviteCode)}`
}

export function buildInviteUrl(request: Request, inviteCode: string) {
  return new URL(buildInviteJoinPath(inviteCode), request.url).toString()
}

export async function listWorkspaceInvites(userId: string, workspaceSlug: string) {
  const workspace = await requireWorkspaceForInviteAction(userId, workspaceSlug)
  const invites = await db
    .select(inviteSelectFields())
    .from(workspaceInvites)
    .where(eq(workspaceInvites.workspaceId, workspace.id))
    .orderBy(asc(workspaceInvites.createdAt))

  return {
    workspace,
    invites,
  }
}

export async function createWorkspaceInvite(
  userId: string,
  workspaceSlug: string,
  input: CreateInviteInput
) {
  const workspace = await requireWorkspaceForInviteAction(userId, workspaceSlug)

  await ensureWorkspaceHasActiveDomain(workspace.id)

  const expiresAt = parseExpiresAt(input.expiresAt)

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const [invite] = await db
        .insert(workspaceInvites)
        .values({
          workspaceId: workspace.id,
          code: createInviteCode(),
          role: input.role,
          status: "active",
          createdByUserId: userId,
          expiresAt,
          maxUses: input.maxUses,
        })
        .returning(inviteSelectFields())

      if (!invite) {
        throw new AppError({
          code: "INVITE_CREATE_FAILED",
          message: "Invite could not be created. Please try again.",
          status: 500,
        })
      }

      return {
        workspace,
        invite,
      }
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("workspace_invites_code_unique")
      ) {
        continue
      }

      throw error
    }
  }

  throw new AppError({
    code: "INVITE_CODE_GENERATION_FAILED",
    message: "Invite code could not be generated. Please try again.",
    status: 500,
  })
}

export async function getInvitePreview(inviteCode: string) {
  const code = normalizeInviteCode(inviteCode)
  const [invite] = await db
    .select({
      ...inviteSelectFields(),
      workspaceName: workspaces.name,
      workspaceSlug: workspaces.slug,
      workspaceLogoUrl: workspaces.logoUrl,
      workspaceArchivedAt: workspaces.archivedAt,
    })
    .from(workspaceInvites)
    .innerJoin(workspaces, eq(workspaces.id, workspaceInvites.workspaceId))
    .where(eq(workspaceInvites.code, code))
    .limit(1)

  if (!invite || invite.workspaceArchivedAt) {
    throw new NotFoundError("Invite link not found.")
  }

  const now = new Date()
  const isExpired = Boolean(invite.expiresAt && invite.expiresAt <= now)
  const isExhausted = Boolean(invite.maxUses && invite.usedCount >= invite.maxUses)

  return {
    invite: {
      id: invite.id,
      code: invite.code,
      role: invite.role,
      status: invite.status,
      expiresAt: invite.expiresAt,
      maxUses: invite.maxUses,
      usedCount: invite.usedCount,
      isExpired,
      isExhausted,
    },
    workspace: {
      id: invite.workspaceId,
      name: invite.workspaceName,
      slug: invite.workspaceSlug,
      logoUrl: invite.workspaceLogoUrl,
    },
    canAccept: invite.status === "active" && !isExpired && !isExhausted,
  }
}

async function assertInviteCanBeAccepted(inviteCode: string) {
  const code = normalizeInviteCode(inviteCode)
  const [invite] = await db
    .select({
      id: workspaceInvites.id,
      workspaceId: workspaceInvites.workspaceId,
      code: workspaceInvites.code,
      role: workspaceInvites.role,
      status: workspaceInvites.status,
      createdByUserId: workspaceInvites.createdByUserId,
      expiresAt: workspaceInvites.expiresAt,
      maxUses: workspaceInvites.maxUses,
      usedCount: workspaceInvites.usedCount,
      workspaceName: workspaces.name,
      workspaceSlug: workspaces.slug,
      workspaceArchivedAt: workspaces.archivedAt,
    })
    .from(workspaceInvites)
    .innerJoin(workspaces, eq(workspaces.id, workspaceInvites.workspaceId))
    .where(
      and(
        eq(workspaceInvites.code, code),
        eq(workspaceInvites.status, "active"),
        or(isNull(workspaceInvites.expiresAt), gt(workspaceInvites.expiresAt, new Date())),
        or(
          isNull(workspaceInvites.maxUses),
          sql`${workspaceInvites.usedCount} < ${workspaceInvites.maxUses}`
        ),
        isNull(workspaces.archivedAt)
      )
    )
    .limit(1)

  if (!invite) {
    throw new ForbiddenError("This invite link is no longer valid.")
  }

  return invite
}

export async function acceptInvite(userId: string, inviteCode: string) {
  const invite = await assertInviteCanBeAccepted(inviteCode)
  const [existingMembership] = await db
    .select({
      id: workspaceMemberships.id,
      status: workspaceMemberships.status,
    })
    .from(workspaceMemberships)
    .where(
      and(
        eq(workspaceMemberships.workspaceId, invite.workspaceId),
        eq(workspaceMemberships.userId, userId)
      )
    )
    .limit(1)

  if (existingMembership?.status === "active") {
    const onboarding = await getOnboardingStateForUser(userId)

    return {
      workspace: {
        id: invite.workspaceId,
        name: invite.workspaceName,
        slug: invite.workspaceSlug,
      },
      membershipAlreadyExisted: true,
      nextPath: onboarding.nextStep === "complete" ? `/${invite.workspaceSlug}/reports` : "/welcome",
    }
  }

  await db.batch([
    db
      .insert(workspaceMemberships)
      .values({
        workspaceId: invite.workspaceId,
        userId,
        role: invite.role as Exclude<WorkspaceRole, "owner">,
        status: "active",
        invitedByUserId: invite.createdByUserId,
        joinedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [workspaceMemberships.workspaceId, workspaceMemberships.userId],
        set: {
          role: invite.role as Exclude<WorkspaceRole, "owner">,
          status: "active",
          invitedByUserId: invite.createdByUserId,
          joinedAt: new Date(),
          updatedAt: new Date(),
        },
      }),
    db
      .update(workspaceInvites)
      .set({
        usedCount: sql`${workspaceInvites.usedCount} + 1`,
        status: sql`case when ${workspaceInvites.maxUses} is not null and ${workspaceInvites.usedCount} + 1 >= ${workspaceInvites.maxUses} then 'exhausted'::invite_status else ${workspaceInvites.status} end`,
        updatedAt: new Date(),
      })
      .where(eq(workspaceInvites.id, invite.id)),
  ])

  const onboarding = await getOnboardingStateForUser(userId)

  return {
    workspace: {
      id: invite.workspaceId,
      name: invite.workspaceName,
      slug: invite.workspaceSlug,
    },
    membershipAlreadyExisted: false,
    nextPath: onboarding.nextStep === "complete" ? `/${invite.workspaceSlug}/reports` : "/welcome",
  }
}
