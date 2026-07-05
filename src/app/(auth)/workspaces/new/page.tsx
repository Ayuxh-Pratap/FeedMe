import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { AuthContentFrame } from "@/components/feedme/auth-ui"
import { NewWorkspaceForm } from "@/components/feedme/dashboard/new-workspace-form"
import { getCurrentSession } from "@/server/auth/current-user"
import { getOnboardingStateForUser } from "@/server/onboarding/service"

export const metadata: Metadata = {
  title: "New workspace",
  description: "Create a new FeedMe workspace and add its first capture domain.",
}

export default async function NewWorkspacePage() {
  const currentSession = await getCurrentSession()

  if (!currentSession) {
    redirect("/login")
  }

  const onboarding = await getOnboardingStateForUser(currentSession.user.id)

  if (onboarding.nextStep !== "complete") {
    redirect("/welcome")
  }

  return (
    <AuthContentFrame>
      <NewWorkspaceForm backHref={onboarding.nextPath} />
    </AuthContentFrame>
  )
}
