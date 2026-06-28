import { ReportsEmptyState } from "@/components/feedme/dashboard/reports-empty-state"
import { ReportsList } from "@/components/feedme/dashboard/reports-list"
import { getMockReports } from "@/lib/mock/dashboard"

type ReportsPageProps = {
  params: Promise<{
    workspaceSlug: string
  }>
}

export default async function ReportsPage({ params }: ReportsPageProps) {
  const { workspaceSlug } = await params
  const reports = getMockReports(workspaceSlug)

  if (reports.length === 0) {
    return <ReportsEmptyState />
  }

  return <ReportsList reports={reports} workspaceSlug={workspaceSlug} />
}
