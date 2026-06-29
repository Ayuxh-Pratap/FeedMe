import { MyWorkPage } from "@/components/feedme/dashboard/my-work-page"
import { getMockReports } from "@/lib/mock/dashboard"

type MyWorkRouteProps = {
  params: Promise<{
    workspaceSlug: string
  }>
}

export default async function MyWorkRoute({ params }: MyWorkRouteProps) {
  const { workspaceSlug } = await params
  const reports = getMockReports(workspaceSlug)

  return <MyWorkPage reports={reports} workspaceSlug={workspaceSlug} />
}
