import { createHash, randomBytes } from "node:crypto"

import { and, desc, eq, gt, isNull, lt, or } from "drizzle-orm"

import { db } from "@/db"
import {
  personalAccessTokens,
  workspaceMemberships,
  workspaces,
} from "@/db/schema"

// Personal access tokens authenticate a coding agent over MCP. Only the hash is
// stored (mirror sessions); the plaintext token is shown to the user once.
const TOKEN_PREFIX = "feedme_pat_"
const DEFAULT_TOKEN_LIFETIME_MS = 90 * 24 * 60 * 60 * 1000
const LAST_USED_WRITE_INTERVAL_MS = 15 * 60 * 1000

type WorkspaceRole = (typeof workspaceMemberships.$inferSelect)["role"]

export type AccessTokenContext = {
  tokenId: string
  userId: string
  workspaceId: string
  workspaceSlug: string
  role: WorkspaceRole
}

export type AccessTokenSummary = {
  active: boolean
  id: string
  label: string
  expiresAt: Date
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
  const expiresAt = new Date(Date.now() + DEFAULT_TOKEN_LIFETIME_MS)
  const [record] = await db
    .insert(personalAccessTokens)
    .values({
      workspaceId,
      userId,
      tokenHash: hashAccessToken(token),
      label,
      expiresAt,
    })
    .returning({
      id: personalAccessTokens.id,
      label: personalAccessTokens.label,
      createdAt: personalAccessTokens.createdAt,
      expiresAt: personalAccessTokens.expiresAt,
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
        gt(personalAccessTokens.expiresAt, new Date()),
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
    .where(
      and(
        eq(personalAccessTokens.id, row.tokenId),
        or(
          isNull(personalAccessTokens.lastUsedAt),
          lt(
            personalAccessTokens.lastUsedAt,
            new Date(Date.now() - LAST_USED_WRITE_INTERVAL_MS)
          )
        )
      )
    )

  return row
}

export async function listAccessTokens(
  workspaceId: string,
  userId: string
): Promise<AccessTokenSummary[]> {
  const now = new Date()
  const rows = await db
    .select({
      id: personalAccessTokens.id,
      label: personalAccessTokens.label,
      lastUsedAt: personalAccessTokens.lastUsedAt,
      revokedAt: personalAccessTokens.revokedAt,
      createdAt: personalAccessTokens.createdAt,
      expiresAt: personalAccessTokens.expiresAt,
    })
    .from(personalAccessTokens)
    .where(
      and(
        eq(personalAccessTokens.workspaceId, workspaceId),
        eq(personalAccessTokens.userId, userId)
      )
    )
    .orderBy(desc(personalAccessTokens.createdAt))

  return rows.map((row) => ({
    ...row,
    active: row.revokedAt === null && row.expiresAt > now,
  }))
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
