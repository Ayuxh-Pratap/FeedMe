import type { ReactNode } from "react"

import { OnboardingShell } from "@/components/feedme/experience/onboarding-shell"

export default function AuthLayout({ children }: { children: ReactNode }) {
  return <OnboardingShell>{children}</OnboardingShell>
}
