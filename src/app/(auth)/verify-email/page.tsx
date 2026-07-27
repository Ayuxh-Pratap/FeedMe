import type { Metadata } from "next"

import { AuthContentFrame, AuthHeading } from "@/components/feedme/auth-ui"
import { VerifyEmailForm } from "@/components/feedme/auth/account-recovery-forms"

type Props = { searchParams: Promise<{ token?: string | string[] }> }
export const metadata: Metadata = { title: "Verify email" }

export default async function VerifyEmailPage({ searchParams }: Props) {
  const value = (await searchParams).token
  const token = Array.isArray(value) ? value[0] : value ?? null

  return (
    <AuthContentFrame>
      <AuthHeading title="Verify your email" description="Securing your FeedMe account and preparing your workspace." />
      <VerifyEmailForm token={token} />
    </AuthContentFrame>
  )
}
