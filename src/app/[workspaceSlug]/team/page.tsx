import type { Metadata } from "next"

import { TeamPage } from "@/components/feedme/dashboard/team-page"
import { requireCurrentSession } from "@/server/auth/current-user"
import { listWorkspaceMembers } from "@/server/members/service"

type TeamRouteProps = {
  params: Promise<{
    workspaceSlug: string
  }>
}

export const metadata: Metadata = {
  title: "Team",
}

export default async function TeamRoute({ params }: TeamRouteProps) {
  const { workspaceSlug } = await params
  const currentSession = await requireCurrentSession()
  const { members, workspace } = await listWorkspaceMembers(
    currentSession.user.id,
    workspaceSlug
  )

  return (
    <TeamPage
      members={members}
      workspaceName={workspace.name}
      workspaceSlug={workspace.slug}
    />
  )
}
