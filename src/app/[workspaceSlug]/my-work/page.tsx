import type { Metadata } from "next"

import { MyWorkPage } from "@/components/feedme/dashboard/my-work-page"

type MyWorkRouteProps = {
  params: Promise<{
    workspaceSlug: string
  }>
}

export const metadata: Metadata = {
  title: "My Work",
}

export default async function MyWorkRoute({
  params,
}: MyWorkRouteProps) {
  const { workspaceSlug } = await params

  return <MyWorkPage workspaceSlug={workspaceSlug} />
}
