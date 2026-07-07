import type { Metadata } from "next"

import { ReportsList } from "@/components/feedme/dashboard/reports-list"

type ReportsPageProps = {
  params: Promise<{
    workspaceSlug: string
  }>
}

export const metadata: Metadata = {
  title: "Reports",
}

export default async function ReportsPage({
  params,
}: ReportsPageProps) {
  const { workspaceSlug } = await params

  return <ReportsList workspaceSlug={workspaceSlug} />
}
