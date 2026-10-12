import type { Metadata } from "next"
import { redirect } from "next/navigation"

import {
  AuthContentFrame,
  AuthDivider,
  AuthHeading,
  SocialAuthButtons,
} from "@/components/feedme/auth-ui"
import { DemoModeInfo } from "@/components/feedme/auth/demo-mode-info"
import { LoginForm } from "@/components/feedme/auth/login-form"
import { RouteTransitionLink } from "@/components/feedme/experience/route-transition-button"
import { getSafeNextPath } from "@/lib/safe-next-path"
import { getCurrentSession } from "@/server/auth/current-user"
import {
  getAuthMode,
  getDemoAccountCredentials,
} from "@/server/auth/config"
import { getOnboardingStateForUser } from "@/server/onboarding/service"

type LoginPageProps = {
  searchParams: Promise<{
    next?: string | string[]
  }>
}

function firstParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value
}

export const metadata: Metadata = {
  title: "Log in",
  description: "Log in to your FeedMe workspace to review and triage feedback.",
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const nextPath = getSafeNextPath(firstParam((await searchParams).next))
  const signupHref = nextPath
    ? `/signup?next=${encodeURIComponent(nextPath)}`
    : "/signup"
  const currentSession = await getCurrentSession()

  if (currentSession) {
    const onboarding = await getOnboardingStateForUser(currentSession.user.id)

    redirect(nextPath ?? onboarding.nextPath)
  }

  const demoMode = getAuthMode() === "demo"
  const demoCredentials = demoMode ? getDemoAccountCredentials() : undefined

  return (
    <AuthContentFrame>
      <section className="w-full">
        <AuthHeading
          title="Sign in to your account"
          accessory={demoMode ? <DemoModeInfo /> : undefined}
        />

        <SocialAuthButtons />

        <div className="my-4">
          <AuthDivider label="or log in with email" />
        </div>

        <LoginForm demoCredentials={demoCredentials} />

        <div>
          <p className="pt-3 text-center text-body-3 font-medium text-muted-foreground">
            New to FeedMe?{" "}
            <RouteTransitionLink
              href={signupHref}
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
