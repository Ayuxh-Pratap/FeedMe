import type { Metadata } from "next"

import { AuthContentFrame, AuthHeading } from "@/components/feedme/auth-ui"
import { ResetPasswordForm } from "@/components/feedme/auth/account-recovery-forms"

type Props = { searchParams: Promise<{ token?: string | string[] }> }
export const metadata: Metadata = { title: "Choose a new password" }

export default async function ResetPasswordPage({ searchParams }: Props) {
  const value = (await searchParams).token
  const token = Array.isArray(value) ? value[0] : value ?? null

  return (
    <AuthContentFrame>
      <AuthHeading title="Choose a new password" description="This signs out your other FeedMe sessions." />
      <ResetPasswordForm token={token} />
    </AuthContentFrame>
  )
}
