import { MyWorkPage } from "@/components/feedme/dashboard/my-work-page"
import { requireCurrentSession } from "@/server/auth/current-user"
import { listWorkspaceReports } from "@/server/reports/service"

type MyWorkRouteProps = {
  params: Promise<{
    workspaceSlug: string
  }>
}

export default async function MyWorkRoute({ params }: MyWorkRouteProps) {
  const { workspaceSlug } = await params
  const currentSession = await requireCurrentSession()
  const { reports, workspace } = await listWorkspaceReports(
    currentSession.user.id,
    workspaceSlug
  )

  return (
    <MyWorkPage
      currentUserId={currentSession.user.id}
      currentUserRole={workspace.role}
      reports={reports}
      workspaceSlug={workspaceSlug}
    />
  )
}
