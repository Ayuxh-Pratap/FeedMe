import { eq } from "drizzle-orm"

import { db } from "@/db"
import { workspaces } from "@/db/schema"

export const RESERVED_WORKSPACE_SLUGS = new Set([
  "login",
  "signup",
  "welcome",
  "join",
  "api",
  "admin",
  "settings",
  "reports",
  "team",
  "domains",
  "help",
  "extension",
])

function slugifyWorkspaceName(name: string) {
  const slug = name
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "")

  return slug || "workspace"
}

async function workspaceSlugExists(slug: string) {
  const [workspace] = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.slug, slug))
    .limit(1)

  return Boolean(workspace)
}

export async function generateUniqueWorkspaceSlug(name: string) {
  const baseSlug = slugifyWorkspaceName(name)
  const normalizedBase = RESERVED_WORKSPACE_SLUGS.has(baseSlug)
    ? `${baseSlug}-workspace`
    : baseSlug

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate =
      attempt === 0 ? normalizedBase : `${normalizedBase}-${Math.random().toString(36).slice(2, 6)}`

    if (!RESERVED_WORKSPACE_SLUGS.has(candidate) && !(await workspaceSlugExists(candidate))) {
      return candidate
    }
  }

  return `${normalizedBase}-${crypto.randomUUID().slice(0, 8)}`
}
