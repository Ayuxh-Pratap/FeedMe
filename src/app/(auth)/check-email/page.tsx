import type { Metadata } from "next"

import { AuthContentFrame, AuthHeading } from "@/components/feedme/auth-ui"
import { ResendVerificationForm } from "@/components/feedme/auth/account-recovery-forms"
import { RouteTransitionLink } from "@/components/feedme/experience/route-transition-button"

export const metadata: Metadata = { title: "Check your email" }

export default function CheckEmailPage() {
  return (
    <AuthContentFrame>
      <AuthHeading
        title="Check your email"
        description="Use the verification link we sent to continue. For privacy, this page looks the same for every address."
      />
      <ResendVerificationForm />
      <p className="pt-4 text-center text-body-3 text-muted-foreground">
        Already verified? <RouteTransitionLink href="/login" className="font-medium text-foreground">Log in</RouteTransitionLink>
      </p>
    </AuthContentFrame>
  )
}
