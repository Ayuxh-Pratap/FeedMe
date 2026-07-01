import { redirect } from "next/navigation"

import {
  AuthContentFrame,
  AuthDivider,
  AuthHeading,
  SocialAuthButtons,
} from "@/components/feedme/auth-ui"
import { LoginForm } from "@/components/feedme/auth/login-form"
import { RouteTransitionLink } from "@/components/feedme/experience/route-transition-button"
import { getCurrentSession } from "@/server/auth/current-user"
import { getOnboardingStateForUser } from "@/server/onboarding/service"

export default async function LoginPage() {
  const currentSession = await getCurrentSession()

  if (currentSession) {
    const onboarding = await getOnboardingStateForUser(currentSession.user.id)

    redirect(onboarding.nextPath)
  }

  return (
    <AuthContentFrame>
      <section className="w-full">
        <AuthHeading title="Sign in to your account" />

        <SocialAuthButtons />

        <div className="my-4">
          <AuthDivider label="or log in with email" />
        </div>

        <LoginForm />

        <div>
          <p className="pt-3 text-center text-body-3 font-medium text-muted-foreground">
            New to FeedMe?{" "}
            <RouteTransitionLink
              href="/signup"
              className="font-medium text-foreground hover:text-text-secondary"
            >
              Create account
            </RouteTransitionLink>
          </p>
        </div>
      </section>
    </AuthContentFrame>
  )
}
