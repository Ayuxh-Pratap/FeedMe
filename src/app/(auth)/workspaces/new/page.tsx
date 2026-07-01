import { redirect } from "next/navigation"

import { AuthContentFrame } from "@/components/feedme/auth-ui"
import { NewWorkspaceForm } from "@/components/feedme/dashboard/new-workspace-form"
import { getCurrentSession } from "@/server/auth/current-user"
import { getOnboardingStateForUser } from "@/server/onboarding/service"

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
