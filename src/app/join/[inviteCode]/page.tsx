import { notFound } from "next/navigation"

import {
  AuthContentFrame,
  AuthHeading,
} from "@/components/feedme/auth-ui"
import { OnboardingShell } from "@/components/feedme/experience/onboarding-shell"
import { JoinInvitePanel } from "@/components/feedme/join/join-invite-panel"
import { getCurrentSession } from "@/server/auth/current-user"
import { getInvitePreview } from "@/server/invites/service"
import { inviteCodeParamSchema } from "@/server/invites/validation"

type JoinInvitePageProps = {
  params: Promise<{
    inviteCode: string
  }>
}

export default async function JoinInvitePage({ params }: JoinInvitePageProps) {
  const { inviteCode } = await params
  const parsedInviteCode = inviteCodeParamSchema.safeParse(inviteCode)

  if (!parsedInviteCode.success) {
    notFound()
  }

  const [currentSession, invitePreview] = await Promise.all([
    getCurrentSession(),
    getInvitePreview(parsedInviteCode.data).catch(() => null),
  ])

  if (!invitePreview) {
    notFound()
  }

  return (
    <OnboardingShell>
      <AuthContentFrame>
        <section>
          <AuthHeading
            title={`Join ${invitePreview.workspace.name}`}
            description={`You have been invited to join this workspace as ${invitePreview.invite.role.replace(/_/g, " ")}.`}
          />

          <div className="mb-5 rounded-lg border border-border-hairline bg-fill-translucent px-3 py-3">
            <p className="text-caption text-text-muted">Invite code</p>
            <p className="mt-1 font-mono text-body-3 text-foreground">
              {invitePreview.invite.code}
            </p>
          </div>

          <JoinInvitePanel
            authenticated={Boolean(currentSession)}
            canAccept={invitePreview.canAccept}
            inviteCode={invitePreview.invite.code}
            role={invitePreview.invite.role}
            workspaceName={invitePreview.workspace.name}
          />
        </section>
      </AuthContentFrame>
    </OnboardingShell>
  )
}
