"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { Check, LogIn, UserPlus } from "lucide-react"
import { useState } from "react"

import { AuthButton } from "@/components/feedme/auth-ui"
import { ApiClientError, postJson } from "@/lib/api-client"

type JoinInvitePanelProps = {
  authenticated: boolean
  canAccept: boolean
  inviteCode: string
  role: string
  workspaceName: string
}

type AcceptInviteResponse = {
  nextPath: string
}

export function JoinInvitePanel({
  authenticated,
  canAccept,
  inviteCode,
  role,
  workspaceName,
}: JoinInvitePanelProps) {
  const router = useRouter()
  const [isAccepting, setIsAccepting] = useState(false)
  const [isRedirecting, setIsRedirecting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const joinPath = `/join/${encodeURIComponent(inviteCode)}`
  const nextParam = encodeURIComponent(joinPath)
  const isBusy = isAccepting || isRedirecting

  async function acceptInvite() {
    if (isBusy) {
      return
    }

    setIsAccepting(true)
    setErrorMessage(null)

    try {
      const result = await postJson<AcceptInviteResponse>(
        `/api/invites/${encodeURIComponent(inviteCode)}/accept`
      )

      setIsRedirecting(true)
      router.push(result.nextPath)
      router.refresh()
    } catch (error) {
      setErrorMessage(
        error instanceof ApiClientError
          ? error.message
          : "Unable to accept invite. Please try again."
      )
      setIsAccepting(false)
      setIsRedirecting(false)
    }
  }

  if (!canAccept) {
    return (
      <p className="rounded-lg border border-border-hairline bg-fill-translucent px-3 py-2 text-body-3 text-text-body">
        This invite link is no longer active.
      </p>
    )
  }

  if (!authenticated) {
    return (
      <div className="grid gap-2 sm:grid-cols-2">
        <Link
          href={`/login?next=${nextParam}`}
          className="relative isolate inline-flex h-10 items-center justify-center gap-2 overflow-hidden rounded-lg border-primary-soft/60 px-3 text-heading-5 [background:var(--gradient-primary-premium)] text-primary-foreground shadow-[var(--elevation-primary-premium)] transition-all duration-base ease-out-soft hover:shadow-[var(--elevation-primary-premium-hover)] active:scale-[var(--press-scale)]"
        >
          <LogIn className="size-4" />
          Log in to join
        </Link>
        <Link
          href={`/signup?next=${nextParam}`}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border-subtle bg-surface-raised px-3 text-heading-5 text-foreground shadow-button-hover transition-all duration-base ease-out-soft hover:border-border-strong hover:brightness-110 active:scale-[var(--press-scale)]"
        >
          <UserPlus className="size-4" />
          Create account
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {errorMessage ? (
        <p role="alert" className="text-body-3 font-medium text-destructive">
          {errorMessage}
        </p>
      ) : null}
      <AuthButton
        type="button"
        className="w-full"
        disabled={isBusy}
        onClick={() => {
          void acceptInvite()
        }}
      >
        {isRedirecting ? "Opening workspace..." : isAccepting ? "Joining..." : `Join ${workspaceName}`}
        {!isBusy ? <Check className="size-4" /> : null}
      </AuthButton>
      <p className="text-center text-caption text-text-muted">
        You will join as {role.replace(/_/g, " ")}.
      </p>
    </div>
  )
}
