import type { ReactNode } from "react"

import { WorkspaceShell } from "@/components/feedme/dashboard/workspace-shell"
import { getMockWorkspace } from "@/lib/mock/dashboard"

type WorkspaceLayoutProps = {
  children: ReactNode
  params: Promise<{
    workspaceSlug: string
  }>
}

export default async function WorkspaceLayout({
  children,
  params,
}: WorkspaceLayoutProps) {
  const { workspaceSlug } = await params
  const workspace = getMockWorkspace(workspaceSlug)

  return <WorkspaceShell workspace={workspace}>{children}</WorkspaceShell>
}
