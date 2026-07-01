import { ReportsEmptyState } from "@/components/feedme/dashboard/reports-empty-state"
import { ReportsList } from "@/components/feedme/dashboard/reports-list"
import { requireCurrentSession } from "@/server/auth/current-user"
import { listWorkspaceReports } from "@/server/reports/service"

type ReportsPageProps = {
  params: Promise<{
    workspaceSlug: string
  }>
}

export default async function ReportsPage({ params }: ReportsPageProps) {
  const { workspaceSlug } = await params
  const currentSession = await requireCurrentSession()
  const { reports } = await listWorkspaceReports(
    currentSession.user.id,
    workspaceSlug
  )

  if (reports.length === 0) {
    return <ReportsEmptyState />
  }

  return <ReportsList reports={reports} workspaceSlug={workspaceSlug} />
}
