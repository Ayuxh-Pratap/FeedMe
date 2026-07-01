import { notFound } from "next/navigation"

import { ReportDetail } from "@/components/feedme/dashboard/report-detail"
import { requireCurrentSession } from "@/server/auth/current-user"
import { NotFoundError } from "@/server/http/errors"
import { getWorkspaceReport } from "@/server/reports/service"
import { reportIdParamSchema } from "@/server/reports/validation"

type ReportDetailPageProps = {
  params: Promise<{
    reportId: string
    workspaceSlug: string
  }>
}

export default async function ReportDetailPage({ params }: ReportDetailPageProps) {
  const { reportId, workspaceSlug } = await params
  const parsedReportId = reportIdParamSchema.safeParse(reportId)

  if (!parsedReportId.success) {
    notFound()
  }

  let report: Awaited<ReturnType<typeof getWorkspaceReport>>["report"] | null = null

  try {
    const currentSession = await requireCurrentSession()
    const result = await getWorkspaceReport(
      currentSession.user.id,
      workspaceSlug,
      parsedReportId.data
    )

    report = result.report
  } catch (error) {
    if (error instanceof NotFoundError) {
      notFound()
    }

    throw error
  }

  if (!report) {
    notFound()
  }

  return <ReportDetail report={report} workspaceSlug={workspaceSlug} />
}
