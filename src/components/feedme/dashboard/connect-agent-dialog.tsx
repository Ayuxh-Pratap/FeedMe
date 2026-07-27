"use client"

import { useMemo, useState } from "react"
import { Bot, Check, Copy, KeyRound, Loader2, ShieldCheck, X } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { ApiClientError } from "@/lib/api-client"
import type { MockWorkspace } from "@/lib/mock/dashboard"
import {
  useCreateWorkspaceTokenMutation,
  useRevokeWorkspaceTokenMutation,
  useWorkspaceTokensQuery,
  type AgentToken,
} from "@/lib/token-queries"
import { cn } from "@/lib/utils"

function CopyButton({
  value,
  label = "Copy",
}: {
  value: string
  label?: string
}) {
  const [copied, setCopied] = useState(false)

  return (
    <button
      type="button"
      aria-label={copied ? "Copied" : label}
      onClick={() => {
        void navigator.clipboard.writeText(value).then(() => {
          setCopied(true)
          window.setTimeout(() => setCopied(false), 1600)
        })
      }}
      className="inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-border-hairline bg-fill-translucent px-2.5 text-caption text-text-body shadow-button-secondary transition-all duration-base ease-out-soft hover:bg-fill-subtle hover:text-foreground hover:shadow-button-hover active:scale-[var(--press-scale)]"
    >
      {copied ? (
        <Check className="size-3.5 text-success" />
      ) : (
        <Copy className="size-3.5" />
      )}
      {copied ? "Copied" : label}
    </button>
  )
}

function formatTokenMeta(token: AgentToken) {
  if (token.revokedAt) {
    return "Revoked"
  }

  if (!token.active) {
    return "Expired"
  }

  if (token.lastUsedAt) {
    return `Last used ${new Date(token.lastUsedAt).toLocaleDateString()} - expires ${new Date(token.expiresAt).toLocaleDateString()}`
  }

  return `Never used - expires ${new Date(token.expiresAt).toLocaleDateString()}`
}

export function ConnectAgentDialog({
  onOpenChange,
  open,
  workspace,
}: {
  onOpenChange: (open: boolean) => void
  open: boolean
  workspace: MockWorkspace
}) {
  const [label, setLabel] = useState("")
  const [revealedToken, setRevealedToken] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const tokensQuery = useWorkspaceTokensQuery({
    enabled: open,
    workspaceSlug: workspace.slug,
  })
  const createTokenMutation = useCreateWorkspaceTokenMutation(workspace.slug)
  const revokeTokenMutation = useRevokeWorkspaceTokenMutation(workspace.slug)
  const tokens = tokensQuery.data?.tokens ?? []
  const isLoading = open && tokens.length === 0 && tokensQuery.isPending
  const isGenerating = createTokenMutation.isPending
  const revokingId = revokeTokenMutation.isPending
    ? revokeTokenMutation.variables?.tokenId ?? null
    : null
  const queryErrorMessage =
    tokensQuery.error instanceof Error
      ? tokensQuery.error.message
      : tokensQuery.isError
        ? "Unable to load tokens. Please try again."
        : null
  const displayErrorMessage = errorMessage ?? queryErrorMessage
  const mcpUrl = useMemo(
    () =>
      typeof window !== "undefined"
        ? `${window.location.origin}/api/mcp`
        : "/api/mcp",
    []
  )
  const configSnippet = useMemo(() => {
    if (!revealedToken) {
      return null
    }

    return JSON.stringify(
      {
        mcpServers: {
          feedme: {
            url: mcpUrl,
            headers: { Authorization: `Bearer ${revealedToken}` },
          },
        },
      },
      null,
      2
    )
  }, [mcpUrl, revealedToken])

  // Never keep a plaintext token around after the dialog closes.
  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setRevealedToken(null)
      setLabel("")
      setErrorMessage(null)
    }

    onOpenChange(nextOpen)
  }

  async function generateToken() {
    const value = label.trim()
    if (!value) {
      return
    }

    setErrorMessage(null)

    try {
      const result = await createTokenMutation.mutateAsync({
        label: value,
      })

      setRevealedToken(result.token)
      setLabel("")
    } catch (error) {
      setErrorMessage(
        error instanceof ApiClientError
          ? error.message
          : "Unable to generate a token. Please try again."
      )
    }
  }

  async function revokeToken(tokenId: string) {
    setErrorMessage(null)

    try {
      await revokeTokenMutation.mutateAsync({ tokenId })
    } catch (error) {
      setErrorMessage(
        error instanceof ApiClientError
          ? error.message
          : "Unable to revoke that token. Please try again."
      )
    }
  }

  const activeTokens = tokens.filter((token) => token.active)

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[calc(100vh-3rem)] w-[min(calc(100vw-2rem),620px)] !max-w-[min(calc(100vw-2rem),620px)] flex-col gap-0 overflow-hidden rounded-xl border border-border-hairline bg-surface-card p-0 text-foreground shadow-popover sm:!max-w-[min(calc(100vw-2rem),620px)]"
      >
        <div className="flex items-start justify-between gap-4 px-5 pb-4 pt-5">
          <div className="min-w-0">
            <DialogTitle className="flex items-center gap-2 text-heading-3 text-foreground">
              <Bot className="size-5 text-text-secondary" />
              Connect a coding agent
            </DialogTitle>
            <DialogDescription className="mt-1 text-body-3 text-text-body">
              Let a coding agent work your assigned reports in {workspace.name}{" "}
              over MCP.
            </DialogDescription>
          </div>
          <button
            type="button"
            aria-label="Close connect agent dialog"
            onClick={() => handleOpenChange(false)}
            className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-border-hairline bg-fill-translucent text-text-body shadow-button-secondary transition-all duration-base ease-out-soft hover:bg-fill-subtle hover:text-foreground hover:shadow-button-hover active:scale-[var(--press-scale)]"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="feedme-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5">
          <section className="space-y-2">
            <p className="text-heading-5 text-foreground">MCP endpoint</p>
            <div className="flex items-center gap-2 rounded-lg border border-border-hairline bg-background px-3 py-2">
              <code className="min-w-0 flex-1 truncate font-mono text-body-3 text-text-secondary">
                {mcpUrl}
              </code>
              <CopyButton value={mcpUrl} label="Copy URL" />
            </div>
          </section>

          <section className="space-y-2 border-t border-border-hairline pt-4">
            <p className="text-heading-5 text-foreground">Generate a token</p>
            <form
              className="flex flex-col gap-2 sm:flex-row"
              onSubmit={(event) => {
                event.preventDefault()
                void generateToken()
              }}
            >
              <div className="min-w-0 flex-1">
                <input
                  aria-label="Token name"
                  value={label}
                  onChange={(event) => setLabel(event.target.value)}
                  placeholder="e.g. Cursor on this workspace"
                  maxLength={120}
                  disabled={isGenerating}
                  className="h-9 w-full min-w-0 rounded-lg border border-border-subtle bg-background px-3 text-body-3 text-foreground outline-none transition-colors duration-base ease-out-soft placeholder:text-muted-foreground focus:border-border-strong disabled:cursor-not-allowed disabled:opacity-55"
                />
                <p className="mt-1 text-caption text-text-muted">
                  Name it after the device or editor so you can revoke it later.
                </p>
              </div>
              <button
                type="submit"
                disabled={!label.trim() || isGenerating}
                className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-lg border border-border-subtle bg-surface-raised px-3 text-heading-5 text-foreground shadow-button-hover transition-all duration-base ease-out-soft hover:border-border-strong hover:brightness-110 active:scale-[var(--press-scale)] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:border-border-subtle disabled:hover:brightness-100"
              >
                {isGenerating ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <KeyRound className="size-4" />
                )}
                {isGenerating ? "Generating" : "Generate token"}
              </button>
            </form>
          </section>

          <div className="flex items-start gap-2.5 rounded-lg border border-border-hairline bg-fill-translucent px-3 py-2.5">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-text-muted" />
            <p className="text-caption leading-relaxed text-text-body">
              This token is scoped to{" "}
              <span className="text-text-secondary">{workspace.name}</span> only
              and acts as you: it can read the reports assigned to you and move
              your own work forward, using your role. Other workspaces are not
              accessible. Store it like a password.
            </p>
          </div>

          {revealedToken && configSnippet ? (
            <section className="space-y-3 rounded-lg border border-primary-soft/40 bg-fill-translucent p-3">
              <div className="flex items-start gap-2">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary-soft" />
                <p className="text-caption leading-relaxed text-text-secondary">
                  Copy this now — it is shown only once. If you lose it, revoke it
                  and generate a new one.
                </p>
              </div>

              <div className="space-y-1.5">
                <p className="text-caption text-text-muted">Token</p>
                <div className="flex items-center gap-2 rounded-lg border border-border-hairline bg-background px-3 py-2">
                  <code className="min-w-0 flex-1 truncate font-mono text-body-3 text-foreground">
                    {revealedToken}
                  </code>
                  <CopyButton value={revealedToken} label="Copy token" />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-caption text-text-muted">
                    Agent config (Claude Code, Cursor, …)
                  </p>
                  <CopyButton value={configSnippet} label="Copy config" />
                </div>
                <pre className="feedme-scrollbar max-h-56 overflow-auto whitespace-pre rounded-lg border border-border-hairline bg-background p-3 font-mono text-caption text-text-secondary">
                  {configSnippet}
                </pre>
              </div>
            </section>
          ) : null}

          {displayErrorMessage ? (
            <div
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-body-3 font-medium text-destructive"
            >
              {displayErrorMessage}
            </div>
          ) : null}

          <section className="space-y-2 border-t border-border-hairline pt-4">
            <p className="text-heading-5 text-foreground">
              Your tokens
              <span className="ml-1.5 text-caption font-normal text-text-muted">
                {activeTokens.length} active
              </span>
            </p>

            {isLoading ? (
              <div className="rounded-lg border border-border-hairline bg-fill-translucent px-3 py-4 text-center text-body-3 text-text-body">
                Loading tokens...
              </div>
            ) : null}

            {!isLoading && tokens.length === 0 ? (
              <div className="rounded-lg border border-border-hairline bg-fill-translucent px-3 py-4 text-center text-body-3 text-text-body">
                No tokens yet. Generate one above to connect your agent.
              </div>
            ) : null}

            {!isLoading
              ? tokens.map((token) => (
                  <div
                    key={token.id}
                    className={cn(
                      "flex min-h-10 items-center gap-3 rounded-lg border border-border-hairline bg-fill-translucent px-3 py-2",
                      token.revokedAt && "opacity-55"
                    )}
                  >
                    <KeyRound className="size-4 shrink-0 text-text-muted" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-heading-5 text-foreground">
                        {token.label}
                      </p>
                      <p className="mt-0.5 text-caption text-text-muted">
                        {formatTokenMeta(token)}
                      </p>
                    </div>
                    {token.revokedAt ? (
                      <span className="rounded-md border border-border-hairline bg-fill-subtle px-1.5 py-0.5 text-caption text-text-muted">
                        Revoked
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          void revokeToken(token.id)
                        }}
                        disabled={revokingId === token.id}
                        className="flex h-7 cursor-pointer items-center rounded-md border border-border-hairline bg-fill-translucent px-2 text-caption text-text-body shadow-button-secondary transition-all duration-base ease-out-soft hover:bg-fill-subtle hover:text-foreground active:scale-[var(--press-scale)] disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        {revokingId === token.id ? "Revoking" : "Revoke"}
                      </button>
                    )}
                  </div>
                ))
              : null}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}
