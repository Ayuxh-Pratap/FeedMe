"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { KeyRound, Loader2, Monitor, ShieldCheck, X } from "lucide-react"
import { FormEvent, useState } from "react"

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { ApiClientError, deleteJson, getJson, postJson } from "@/lib/api-client"
import { getPasswordPolicyMessage } from "@/lib/password-policy"

type SessionSummary = {
  id: string
  current: boolean
  createdAt: string
  expiresAt: string
  lastUsedAt: string | null
}

type SessionsResponse = { sessions: SessionSummary[] }
const sessionsQueryKey = ["auth", "sessions"] as const

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

export function AccountSecurityDialog({
  onOpenChange,
  open,
}: {
  onOpenChange: (open: boolean) => void
  open: boolean
}) {
  const queryClient = useQueryClient()
  const [currentPassword, setCurrentPassword] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [message, setMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const sessionsQuery = useQuery({
    enabled: open,
    queryFn: () => getJson<SessionsResponse>("/api/auth/sessions"),
    queryKey: sessionsQueryKey,
    staleTime: 30_000,
  })
  const changePasswordMutation = useMutation({
    mutationFn: (input: { currentPassword: string; password: string; confirmPassword: string }) =>
      postJson<{ message: string }>("/api/auth/change-password", input),
  })
  const revokeSessionMutation = useMutation({
    mutationFn: (sessionId: string) =>
      deleteJson<{ revoked: boolean; signedOut: boolean }>(
        `/api/auth/sessions/${encodeURIComponent(sessionId)}`
      ),
    onSuccess: (_result, sessionId) => {
      queryClient.setQueryData<SessionsResponse>(sessionsQueryKey, (current) =>
        current
          ? { sessions: current.sessions.filter((session) => session.id !== sessionId) }
          : current
      )
    },
  })
  const revokeOthersMutation = useMutation({
    mutationFn: () => deleteJson<{ revokedCount: number }>("/api/auth/sessions"),
    onSuccess: () => {
      queryClient.setQueryData<SessionsResponse>(sessionsQueryKey, (current) =>
        current
          ? { sessions: current.sessions.filter((session) => session.current) }
          : current
      )
    },
  })
  const sessions = sessionsQuery.data?.sessions ?? []
  const sessionsError =
    sessionsQuery.error ?? revokeSessionMutation.error ?? revokeOthersMutation.error

  async function handlePasswordChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const passwordIssue = getPasswordPolicyMessage(password)

    if (passwordIssue) {
      setErrorMessage(passwordIssue)
      return
    }
    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.")
      return
    }

    setErrorMessage(null)
    setMessage(null)
    try {
      const result = await changePasswordMutation.mutateAsync({
        currentPassword,
        password,
        confirmPassword,
      })
      setCurrentPassword("")
      setPassword("")
      setConfirmPassword("")
      setMessage(result.message)
      void sessionsQuery.refetch()
    } catch (error) {
      setErrorMessage(
        error instanceof ApiClientError
          ? error.message
          : "Unable to update your password."
      )
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="flex max-h-[calc(100vh-3rem)] w-[min(calc(100vw-2rem),620px)] !max-w-[min(calc(100vw-2rem),620px)] flex-col gap-0 overflow-hidden rounded-xl border border-border-hairline bg-surface-card p-0 text-foreground shadow-popover sm:!max-w-[min(calc(100vw-2rem),620px)]">
        <div className="flex items-start justify-between gap-4 border-b border-border-hairline px-5 py-5">
          <div>
            <DialogTitle className="flex items-center gap-2 text-heading-3"><ShieldCheck className="size-5" />Account security</DialogTitle>
            <DialogDescription className="mt-1 text-body-3 text-text-body">Manage your password and active FeedMe sessions.</DialogDescription>
          </div>
          <button type="button" aria-label="Close account security" onClick={() => onOpenChange(false)} className="flex size-8 items-center justify-center rounded-lg border border-border-hairline bg-fill-translucent text-text-body hover:bg-fill-subtle hover:text-foreground"><X className="size-4" /></button>
        </div>

        <div className="feedme-scrollbar min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5">
          <section>
            <h3 className="flex items-center gap-2 text-heading-5"><KeyRound className="size-4" />Change password</h3>
            <form className="mt-3 grid gap-3" onSubmit={handlePasswordChange}>
              {[
                { label: "Current password", value: currentPassword, setValue: setCurrentPassword, autoComplete: "current-password" },
                { label: "New password", value: password, setValue: setPassword, autoComplete: "new-password" },
                { label: "Confirm new password", value: confirmPassword, setValue: setConfirmPassword, autoComplete: "new-password" },
              ].map((field) => (
                <label key={field.label} className="grid gap-1.5 text-body-3 font-medium">
                  {field.label}
                  <input type="password" value={field.value} onChange={(event) => field.setValue(event.currentTarget.value)} autoComplete={field.autoComplete} disabled={changePasswordMutation.isPending} className="h-9 rounded-lg border border-border-subtle bg-background px-3 text-body-3 outline-none focus:border-border-strong" required />
                </label>
              ))}
              {errorMessage ? <p role="alert" className="text-body-3 text-destructive">{errorMessage}</p> : null}
              {message ? <p role="status" className="text-body-3 text-success">{message}</p> : null}
              <button type="submit" disabled={changePasswordMutation.isPending} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-border-subtle bg-surface-raised px-3 text-heading-5 shadow-button-hover disabled:opacity-45">
                {changePasswordMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
                {changePasswordMutation.isPending ? "Updating" : "Update password"}
              </button>
            </form>
          </section>

          <section className="border-t border-border-hairline pt-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="flex items-center gap-2 text-heading-5"><Monitor className="size-4" />Active sessions</h3>
              {sessions.some((session) => !session.current) ? (
                <button type="button" disabled={revokeOthersMutation.isPending} onClick={() => revokeOthersMutation.mutate()} className="text-caption font-medium text-text-body hover:text-foreground disabled:opacity-45">Sign out others</button>
              ) : null}
            </div>
            <div className="mt-3 space-y-2">
              {sessionsQuery.isPending ? <p className="text-body-3 text-text-muted">Loading sessions...</p> : null}
              {sessionsError ? <p role="alert" className="text-body-3 text-destructive">{sessionsError instanceof Error ? sessionsError.message : "Unable to update sessions."}</p> : null}
              {sessions.map((session) => (
                <div key={session.id} className="flex items-center gap-3 rounded-lg border border-border-hairline bg-fill-translucent px-3 py-2.5">
                  <Monitor className="size-4 shrink-0 text-text-muted" />
                  <div className="min-w-0 flex-1">
                    <p className="text-heading-5">{session.current ? "This session" : "FeedMe session"}</p>
                    <p className="mt-0.5 text-caption text-text-muted">Last active {formatDate(session.lastUsedAt ?? session.createdAt)}</p>
                  </div>
                  {session.current ? <span className="text-caption text-success">Current</span> : (
                    <button type="button" disabled={revokeSessionMutation.isPending} onClick={() => revokeSessionMutation.mutate(session.id)} className="h-7 rounded-md border border-border-hairline bg-fill-translucent px-2 text-caption text-text-body hover:bg-fill-subtle hover:text-foreground disabled:opacity-45">Sign out</button>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}
