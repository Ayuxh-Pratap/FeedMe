import { redirect } from "next/navigation"

import {
  AuthContentFrame,
  AuthDivider,
  AuthHeading,
  SocialAuthButtons,
} from "@/components/feedme/auth-ui"
import { SignupForm } from "@/components/feedme/auth/signup-form"
import { RouteTransitionLink } from "@/components/feedme/experience/route-transition-button"
import { getCurrentSession } from "@/server/auth/current-user"
import { getOnboardingStateForUser } from "@/server/onboarding/service"

export default async function SignupPage() {
  const currentSession = await getCurrentSession()

  if (currentSession) {
    const onboarding = await getOnboardingStateForUser(currentSession.user.id)

    redirect(onboarding.nextPath)
  }

  return (
    <AuthContentFrame>
      <section className="w-full">
        <AuthHeading
          title="Create your account"
          description="Set up your FeedMe login. Your profile and workspace come next."
        />

        <SocialAuthButtons />

        <div className="my-4">
          <AuthDivider label="or create account with email" />
        </div>

        <SignupForm />

        <div>
          <p className="pt-3 text-center text-body-3 font-medium text-muted-foreground">
            Already have an account?{" "}
            <RouteTransitionLink
              href="/login"
              className="font-medium text-foreground hover:text-text-secondary"
            >
              Log in
            </RouteTransitionLink>
          </p>
        </div>
      </section>
    </AuthContentFrame>
  )
}
