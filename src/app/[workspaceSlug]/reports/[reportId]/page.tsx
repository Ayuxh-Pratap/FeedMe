import { cache } from "react"
import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { ReportDetail } from "@/components/feedme/dashboard/report-detail"
import { requireCurrentSession } from "@/server/auth/current-user"
import { NotFoundError } from "@/server/http/errors"
import { listWorkspaceMembers } from "@/server/members/service"
import { getWorkspaceReport } from "@/server/reports/service"
import { reportIdParamSchema } from "@/server/reports/validation"

type ReportDetailPageProps = {
  params: Promise<{
    reportId: string
    workspaceSlug: string
  }>
}

// Cached so generateMetadata and the page share a single DB fetch per request.
const loadReportDetail = cache(async (workspaceSlug: string, reportId: string) => {
  const currentSession = await requireCurrentSession()
  const [reportResult, membersResult] = await Promise.all([
    getWorkspaceReport(currentSession.user.id, workspaceSlug, reportId),
    listWorkspaceMembers(currentSession.user.id, workspaceSlug),
  ])

  return {
    currentUserId: currentSession.user.id,
    members: membersResult.members,
    report: reportResult.report,
    role: reportResult.workspace.role,
  }
})

export async function generateMetadata({
  params,
}: ReportDetailPageProps): Promise<Metadata> {
  const { reportId, workspaceSlug } = await params
  const parsedReportId = reportIdParamSchema.safeParse(reportId)

  if (!parsedReportId.success) {
    return { title: "Report" }
  }

  try {
    const { report } = await loadReportDetail(workspaceSlug, parsedReportId.data)
    return {
      title: report.title,
      description: report.summary,
    }
  } catch {
    return { title: "Report" }
  }
}

export default async function ReportDetailPage({ params }: ReportDetailPageProps) {
  const { reportId, workspaceSlug } = await params
  const parsedReportId = reportIdParamSchema.safeParse(reportId)

  if (!parsedReportId.success) {
    notFound()
  }

  let detail: Awaited<ReturnType<typeof loadReportDetail>>

  try {
    detail = await loadReportDetail(workspaceSlug, parsedReportId.data)
  } catch (error) {
    if (error instanceof NotFoundError) {
      notFound()
    }

    throw error
  }

  return (
    <ReportDetail
      currentUserId={detail.currentUserId}
      currentUserRole={detail.role}
      members={detail.members}
      report={detail.report}
      workspaceSlug={workspaceSlug}
    />
  )
}
