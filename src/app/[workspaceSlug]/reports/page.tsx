import type { Metadata } from "next"

import { ReportsEmptyState } from "@/components/feedme/dashboard/reports-empty-state"
import { ReportsList } from "@/components/feedme/dashboard/reports-list"
import { requireCurrentSession } from "@/server/auth/current-user"
import { listWorkspaceReports } from "@/server/reports/service"
import { listReportsInputSchema } from "@/server/reports/validation"

type ReportsPageProps = {
  params: Promise<{
    workspaceSlug: string
  }>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export const metadata: Metadata = {
  title: "Reports",
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

export default async function ReportsPage({
  params,
  searchParams,
}: ReportsPageProps) {
  const { workspaceSlug } = await params
  const resolvedSearchParams = await searchParams
  const input = listReportsInputSchema.parse(
    normalizeSearchParams(resolvedSearchParams)
  )
  const currentSession = await requireCurrentSession()
  const { pageInfo, reports } = await listWorkspaceReports(
    currentSession.user.id,
    workspaceSlug,
    input
  )

  if (reports.length === 0 && !input.q && input.status === "all") {
    return <ReportsEmptyState />
  }

  return (
    <ReportsList
      pageInfo={pageInfo}
      reports={reports}
      workspaceSlug={workspaceSlug}
    />
  )
}
