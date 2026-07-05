import { createHash, randomBytes } from "node:crypto"

import { and, desc, eq, isNull } from "drizzle-orm"

import { db } from "@/db"
import {
  personalAccessTokens,
  workspaceMemberships,
  workspaces,
} from "@/db/schema"

// Personal access tokens authenticate a coding agent over MCP. Only the hash is
// stored (mirror sessions); the plaintext token is shown to the user once.
const TOKEN_PREFIX = "feedme_pat_"

type WorkspaceRole = (typeof workspaceMemberships.$inferSelect)["role"]

export type AccessTokenContext = {
  tokenId: string
  userId: string
  workspaceId: string
  workspaceSlug: string
  role: WorkspaceRole
}

export type AccessTokenSummary = {
  id: string
  label: string
  lastUsedAt: Date | null
  revokedAt: Date | null
  createdAt: Date
}

function hashAccessToken(token: string) {
  return createHash("sha256").update(token).digest("hex")
}

export async function generateAccessToken(
  userId: string,
  workspaceId: string,
  label: string
) {
  const token = `${TOKEN_PREFIX}${randomBytes(32).toString("base64url")}`
  const [record] = await db
    .insert(personalAccessTokens)
    .values({
      workspaceId,
      userId,
      tokenHash: hashAccessToken(token),
      label,
    })
    .returning({
      id: personalAccessTokens.id,
      label: personalAccessTokens.label,
      createdAt: personalAccessTokens.createdAt,
    })

  return { token, record }
}

// Resolves a raw bearer token to its workspace/user/role context, or null if the
// token is unknown, revoked, or the membership is no longer active. The role is
// read live from the membership so a demoted/removed member loses access.
export async function resolveAccessToken(
  rawToken: string
): Promise<AccessTokenContext | null> {
  if (!rawToken.startsWith(TOKEN_PREFIX)) {
    return null
  }

  const [row] = await db
    .select({
      tokenId: personalAccessTokens.id,
      userId: personalAccessTokens.userId,
      workspaceId: personalAccessTokens.workspaceId,
      workspaceSlug: workspaces.slug,
      role: workspaceMemberships.role,
    })
    .from(personalAccessTokens)
    .innerJoin(workspaces, eq(workspaces.id, personalAccessTokens.workspaceId))
    .innerJoin(
      workspaceMemberships,
      and(
        eq(workspaceMemberships.workspaceId, personalAccessTokens.workspaceId),
        eq(workspaceMemberships.userId, personalAccessTokens.userId),
        eq(workspaceMemberships.status, "active")
      )
    )
    .where(
      and(
        eq(personalAccessTokens.tokenHash, hashAccessToken(rawToken)),
        isNull(personalAccessTokens.revokedAt),
        isNull(workspaces.archivedAt)
      )
    )
    .limit(1)

  if (!row) {
    return null
  }

  await db
    .update(personalAccessTokens)
    .set({ lastUsedAt: new Date() })
    .where(eq(personalAccessTokens.id, row.tokenId))

  return row
}

export async function listAccessTokens(
  workspaceId: string,
  userId: string
): Promise<AccessTokenSummary[]> {
  return db
    .select({
      id: personalAccessTokens.id,
      label: personalAccessTokens.label,
      lastUsedAt: personalAccessTokens.lastUsedAt,
      revokedAt: personalAccessTokens.revokedAt,
      createdAt: personalAccessTokens.createdAt,
    })
    .from(personalAccessTokens)
    .where(
      and(
        eq(personalAccessTokens.workspaceId, workspaceId),
        eq(personalAccessTokens.userId, userId)
      )
    )
    .orderBy(desc(personalAccessTokens.createdAt))
}

export async function revokeAccessToken(
  tokenId: string,
  workspaceId: string,
  userId: string
) {
  await db
    .update(personalAccessTokens)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(personalAccessTokens.id, tokenId),
        eq(personalAccessTokens.workspaceId, workspaceId),
        eq(personalAccessTokens.userId, userId),
        isNull(personalAccessTokens.revokedAt)
      )
    )
}
