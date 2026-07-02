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

export default async function ReportDetailPage({ params }: ReportDetailPageProps) {
  const { reportId, workspaceSlug } = await params
  const parsedReportId = reportIdParamSchema.safeParse(reportId)

  if (!parsedReportId.success) {
    notFound()
  }

  let report: Awaited<ReturnType<typeof getWorkspaceReport>>["report"] | null = null
  let role: Awaited<ReturnType<typeof getWorkspaceReport>>["workspace"]["role"] | null =
    null
  let members: Awaited<ReturnType<typeof listWorkspaceMembers>>["members"] = []
  let currentUserId = ""

  try {
    const currentSession = await requireCurrentSession()
    currentUserId = currentSession.user.id
    const [reportResult, membersResult] = await Promise.all([
      getWorkspaceReport(currentSession.user.id, workspaceSlug, parsedReportId.data),
      listWorkspaceMembers(currentSession.user.id, workspaceSlug),
    ])

    report = reportResult.report
    role = reportResult.workspace.role
    members = membersResult.members
  } catch (error) {
    if (error instanceof NotFoundError) {
      notFound()
    }

    throw error
  }

  if (!report) {
    notFound()
  }

  if (!role) {
    notFound()
  }

  return (
    <ReportDetail
      currentUserId={currentUserId}
      currentUserRole={role}
      members={members}
      report={report}
      workspaceSlug={workspaceSlug}
    />
  )
}
