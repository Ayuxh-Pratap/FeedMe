import { TeamPage } from "@/components/feedme/dashboard/team-page"
import { getMockTeamMembers, getMockWorkspace } from "@/lib/mock/dashboard"

type TeamRouteProps = {
  params: Promise<{
    workspaceSlug: string
  }>
}

export default async function TeamRoute({ params }: TeamRouteProps) {
  const { workspaceSlug } = await params
  const workspace = getMockWorkspace(workspaceSlug)
  const members = getMockTeamMembers(workspaceSlug)

  return (
    <TeamPage
      members={members}
      workspaceName={workspace.name}
      workspaceSlug={workspace.slug}
    />
  )
}
