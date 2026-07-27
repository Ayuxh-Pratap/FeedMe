import type { Metadata } from "next"

import { AuthContentFrame, AuthHeading } from "@/components/feedme/auth-ui"
import { ForgotPasswordForm } from "@/components/feedme/auth/account-recovery-forms"
import { RouteTransitionLink } from "@/components/feedme/experience/route-transition-button"

export const metadata: Metadata = { title: "Reset password" }

export default function ForgotPasswordPage() {
  return (
    <AuthContentFrame>
      <AuthHeading title="Reset your password" description="Enter your account email and we will send a secure reset link." />
      <ForgotPasswordForm />
      <p className="pt-4 text-center text-body-3 text-muted-foreground">
        Remembered it? <RouteTransitionLink href="/login" className="font-medium text-foreground">Back to login</RouteTransitionLink>
      </p>
    </AuthContentFrame>
  )
}
