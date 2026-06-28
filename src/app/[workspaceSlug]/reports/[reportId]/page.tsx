import { notFound } from "next/navigation"

import { ReportDetail } from "@/components/feedme/dashboard/report-detail"
import { getMockReport } from "@/lib/mock/dashboard"

type ReportDetailPageProps = {
  params: Promise<{
    reportId: string
    workspaceSlug: string
  }>
}

export default async function ReportDetailPage({ params }: ReportDetailPageProps) {
  const { reportId, workspaceSlug } = await params
  const report = getMockReport(workspaceSlug, reportId)

  if (!report) {
    notFound()
  }

  return <ReportDetail report={report} workspaceSlug={workspaceSlug} />
}
