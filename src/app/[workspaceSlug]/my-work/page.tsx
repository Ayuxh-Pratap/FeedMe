import type { Metadata } from "next"

import { MyWorkPage } from "@/components/feedme/dashboard/my-work-page"
import { requireCurrentSession } from "@/server/auth/current-user"
import { NotFoundError } from "@/server/http/errors"
import { listWorkspaceReports } from "@/server/reports/service"
import { listReportsInputSchema } from "@/server/reports/validation"
import { getWorkspaceForUserBySlug } from "@/server/workspaces/service"

type MyWorkRouteProps = {
  params: Promise<{
    workspaceSlug: string
  }>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function normalizeSearchParams(
  searchParams?: Record<string, string | string[] | undefined>
) {
  return Object.fromEntries(
    Object.entries(searchParams ?? {}).map(([key, value]) => [
      key,
      Array.isArray(value) ? value[0] : value,
    ])
  )
}

export const metadata: Metadata = {
  title: "My Work",
}

function getDefaultMyWorkScope(role: string) {
  return role === "developer" ? "assigned" : "reported"
}

export default async function MyWorkRoute({
  params,
  searchParams,
}: MyWorkRouteProps) {
  const { workspaceSlug } = await params
  const resolvedSearchParams = await searchParams
  const currentSession = await requireCurrentSession()
  const workspace = await getWorkspaceForUserBySlug(
    currentSession.user.id,
    workspaceSlug
  )

  if (!workspace) {
    throw new NotFoundError("Workspace not found.")
  }

  const input = listReportsInputSchema.parse({
    ...normalizeSearchParams(resolvedSearchParams),
    scope:
      normalizeSearchParams(resolvedSearchParams).scope ??
      getDefaultMyWorkScope(workspace.role),
  })
  const { pageInfo, reports } = await listWorkspaceReports(
    currentSession.user.id,
    workspaceSlug,
    input
  )

  return (
    <MyWorkPage
      currentUserId={currentSession.user.id}
      currentUserRole={workspace.role}
      pageInfo={pageInfo}
      reports={reports}
      workspaceSlug={workspaceSlug}
    />
  )
}
