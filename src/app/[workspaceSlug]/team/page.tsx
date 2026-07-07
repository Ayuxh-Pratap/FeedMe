import type { Metadata } from "next"

import { TeamPage } from "@/components/feedme/dashboard/team-page"

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

  return <TeamPage workspaceSlug={workspaceSlug} />
}
