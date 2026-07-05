import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { WelcomeForm } from "@/components/feedme/auth/welcome-form"
import { AuthContentFrame } from "@/components/feedme/auth-ui"
import { getCurrentSession } from "@/server/auth/current-user"
import { getOnboardingStateForUser } from "@/server/onboarding/service"

export const metadata: Metadata = {
  title: "Welcome",
  description: "Set up your profile and first FeedMe workspace.",
}

export default async function WelcomePage() {
  const currentSession = await getCurrentSession()

  if (!currentSession) {
    redirect("/login")
  }

  const onboarding = await getOnboardingStateForUser(currentSession.user.id)

  if (onboarding.nextStep === "complete") {
    redirect(onboarding.nextPath)
  }

  return (
    <AuthContentFrame>
      <WelcomeForm />
    </AuthContentFrame>
  )
}
