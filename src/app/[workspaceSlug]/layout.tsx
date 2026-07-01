import type { ReactNode } from "react"
import { notFound, redirect } from "next/navigation"

import { WorkspaceShell } from "@/components/feedme/dashboard/workspace-shell"
import { getCurrentSession } from "@/server/auth/current-user"
import { getWorkspaceMemberCount } from "@/server/members/service"
import { getOnboardingStateForUser } from "@/server/onboarding/service"
import { getWorkspaceReportCount } from "@/server/reports/service"
import { getWorkspaceForUserBySlug } from "@/server/workspaces/service"

function initialsFromName(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("")
}

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
  const currentSession = await getCurrentSession()

  if (!currentSession) {
    redirect("/login")
  }

  const onboarding = await getOnboardingStateForUser(currentSession.user.id)

  if (onboarding.nextStep !== "complete") {
    redirect("/welcome")
  }

  const workspaceAccess = await getWorkspaceForUserBySlug(
    currentSession.user.id,
    workspaceSlug
  )

  if (!workspaceAccess) {
    notFound()
  }

  const [memberCount, reportCount] = await Promise.all([
    getWorkspaceMemberCount(workspaceAccess.id),
    getWorkspaceReportCount(workspaceAccess.id),
  ])
  const displayName =
    currentSession.profile?.displayName ?? currentSession.user.email.split("@")[0]
  const title = currentSession.profile?.title ?? workspaceAccess.role
  const workspace = {
    slug: workspaceAccess.slug,
    name: workspaceAccess.name,
    user: {
      displayName,
      title,
      initials: initialsFromName(displayName) || "U",
    },
    stats: [
      { label: "Reports", value: reportCount.toString() },
      { label: "Domains", value: "1" },
      { label: "Members", value: memberCount.toString() },
    ],
    trial: {
      daysLeft: 30,
      seatsUsed: memberCount,
      seatsTotal: Math.max(3, memberCount),
    },
  }

  return <WorkspaceShell workspace={workspace}>{children}</WorkspaceShell>
}
