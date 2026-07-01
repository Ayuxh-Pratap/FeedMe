"use client"

import { Check, ChevronDown, Copy, Link2, Ticket, X } from "lucide-react"
import { useState, type ReactNode } from "react"

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { ApiClientError, postJson } from "@/lib/api-client"
import { cn } from "@/lib/utils"

type InviteMemberDialogProps = {
  children: ReactNode
  workspaceName: string
  workspaceSlug: string
}

const inviteRoles = [
  { label: "Reporter", value: "reporter" },
  { label: "Developer", value: "developer" },
  { label: "Designer", value: "designer" },
  { label: "Viewer", value: "viewer" },
] as const

type InviteRole = (typeof inviteRoles)[number]["value"]

type CreatedInvite = {
  code: string
  role: InviteRole
  joinPath: string
  inviteUrl: string
}

type CreateInviteResponse = {
  invite: CreatedInvite
}

function labelFromRole(role: InviteRole) {
  return inviteRoles.find((item) => item.value === role)?.label ?? "Reporter"
}

function RolePicker({
  onRoleChange,
  role,
}: {
  onRoleChange: (role: InviteRole) => void
  role: InviteRole
}) {
  const [open, setOpen] = useState(false)

  return (
    <div
      className="relative h-9 sm:w-36"
      onBlur={(event) => {
        const nextTarget = event.relatedTarget

        if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) {
          setOpen(false)
        }
      }}
    >
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex h-full w-full cursor-pointer items-center justify-between gap-2 rounded-lg border border-border-subtle bg-fill-translucent px-3 text-body-3 text-foreground shadow-button-secondary outline-none transition-all duration-base ease-out-soft hover:bg-fill-subtle hover:text-foreground focus:border-border-strong active:scale-[var(--press-scale)]"
      >
        <span className="truncate">{labelFromRole(role)}</span>
        <ChevronDown
          className={cn(
            "size-3.5 shrink-0 text-text-muted transition-transform duration-base ease-out-soft",
            open && "rotate-180 text-text-secondary"
          )}
        />
      </button>

      {open ? (
        <div
          role="listbox"
          aria-label="Invite role"
          className="absolute right-0 top-[calc(100%+0.375rem)] z-50 w-40 overflow-hidden rounded-lg border border-border-subtle bg-surface-card p-1 text-foreground shadow-popover"
        >
          {inviteRoles.map((item) => {
            const selected = role === item.value

            return (
              <button
                key={item.value}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  onRoleChange(item.value)
                  setOpen(false)
                }}
                className={cn(
                  "flex h-8 w-full cursor-pointer items-center justify-between rounded-md px-2.5 text-left text-body-3 transition-colors duration-base ease-out-soft",
                  selected
                    ? "bg-surface-raised text-foreground shadow-button-hover"
                    : "text-text-body hover:bg-fill-subtle hover:text-foreground"
                )}
              >
                {item.label}
                {selected ? <Check className="size-3.5 text-text-secondary" /> : null}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

export function InviteMemberDialog({
  children,
  workspaceName,
  workspaceSlug,
}: InviteMemberDialogProps) {
  const [role, setRole] = useState<InviteRole>("reporter")
  const [invite, setInvite] = useState<CreatedInvite | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [copiedValue, setCopiedValue] = useState<"code" | "link" | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const selectedRoleLabel = labelFromRole(role)

  async function createInvite() {
    setIsCreating(true)
    setErrorMessage(null)
    setCopiedValue(null)

    try {
      const result = await postJson<CreateInviteResponse>(
        `/api/workspaces/${encodeURIComponent(workspaceSlug)}/invites`,
        {
          role,
        }
      )

      setInvite(result.invite)
    } catch (error) {
      setErrorMessage(
        error instanceof ApiClientError
          ? error.message
          : "Unable to create invite. Please try again."
      )
    } finally {
      setIsCreating(false)
    }
  }

  async function copyInvite(value: "code" | "link", text?: string) {
    if (!text) {
      return
    }

    try {
      await navigator.clipboard.writeText(text)
      setCopiedValue(value)
      window.setTimeout(() => setCopiedValue(null), 1400)
    } catch {
      setCopiedValue(null)
    }
  }

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent
        showCloseButton={false}
        className="w-[min(calc(100vw-2rem),540px)] !max-w-[min(calc(100vw-2rem),540px)] gap-0 overflow-hidden rounded-xl border border-border-hairline bg-surface-card p-0 text-foreground shadow-popover sm:!max-w-[min(calc(100vw-2rem),540px)]"
      >
        <div className="flex items-start justify-between gap-4 px-5 pb-4 pt-5">
          <div>
            <DialogTitle className="text-heading-3 text-foreground">
              Invite to {workspaceName}
            </DialogTitle>
            <DialogDescription className="mt-1 text-body-3 text-text-body">
              Create a role-scoped invite link and share it anywhere.
            </DialogDescription>
          </div>
          <DialogClose asChild>
            <button
              type="button"
              aria-label="Close invite dialog"
              className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-border-hairline bg-fill-translucent text-text-body shadow-button-secondary transition-all duration-base ease-out-soft hover:bg-fill-subtle hover:text-foreground hover:shadow-button-hover active:scale-[var(--press-scale)]"
            >
              <X className="size-4" />
            </button>
          </DialogClose>
        </div>

        <div className="space-y-4 px-5 py-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border border-border-subtle bg-background py-1 pl-3 pr-1">
              <Ticket className="size-4 shrink-0 text-text-muted" />
              <span className="min-w-0 flex-1 truncate text-body-3 text-text-secondary">
                {invite ? invite.code : "No invite link created yet"}
              </span>
              <button
                type="button"
                aria-label={copiedValue === "code" ? "Invite code copied" : "Copy invite code"}
                disabled={!invite}
                onClick={() => copyInvite("code", invite?.code)}
                className="inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-border-hairline bg-fill-translucent text-text-secondary shadow-button-secondary transition-all duration-base ease-out-soft hover:bg-fill-subtle hover:text-foreground hover:shadow-button-hover active:scale-[var(--press-scale)] disabled:cursor-not-allowed disabled:opacity-45"
              >
                {copiedValue === "code" ? (
                  <Check className="size-3.5" />
                ) : (
                  <Copy className="size-3.5" />
                )}
              </button>
            </div>

            <RolePicker
              role={role}
              onRoleChange={(nextRole) => {
                setRole(nextRole)
                setInvite(null)
                setCopiedValue(null)
                setErrorMessage(null)
              }}
            />
          </div>

          <div className="rounded-lg border border-border-hairline bg-fill-translucent p-2.5">
            <p className="text-caption text-text-muted">Invite link</p>
            <p className="mt-1 truncate text-body-3 text-text-secondary">
              {invite?.inviteUrl ?? "Create a link to copy it here."}
            </p>
          </div>

          {errorMessage ? (
            <p role="alert" className="text-body-3 font-medium text-destructive">
              {errorMessage}
            </p>
          ) : null}

          <div className="flex flex-col gap-2 pt-3 sm:flex-row sm:items-center sm:justify-end">
            <div className="flex flex-col gap-2 sm:ml-auto sm:flex-row">
              <button
                type="button"
                disabled={!invite}
                onClick={() => copyInvite("link", invite?.inviteUrl)}
                className="inline-flex h-8 cursor-pointer items-center justify-center gap-2 rounded-lg border border-border-subtle bg-surface-raised px-3 text-heading-5 text-foreground shadow-button-hover transition-all duration-base ease-out-soft hover:border-border-strong hover:brightness-110 active:scale-[var(--press-scale)] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:border-border-subtle disabled:hover:brightness-100"
              >
                {copiedValue === "link" ? (
                  <Check className="size-4" />
                ) : (
                  <Link2 className="size-4" />
                )}
                {copiedValue === "link" ? "Copied link" : "Copy invite link"}
              </button>
              <button
                type="button"
                onClick={() => {
                  void createInvite()
                }}
                disabled={isCreating}
                className="inline-flex h-8 cursor-pointer items-center justify-center rounded-lg border border-border-hairline bg-surface-raised px-3 text-heading-5 text-foreground shadow-button-hover transition-all duration-base ease-out-soft hover:border-border-strong hover:brightness-110 active:scale-[var(--press-scale)] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:border-border-hairline disabled:hover:brightness-100"
              >
                {isCreating ? "Creating..." : invite ? "Regenerate" : "Generate link"}
              </button>
            </div>
          </div>

          <p className="text-caption text-text-muted">
            New members will join as {selectedRoleLabel.toLowerCase()}s unless their
            role is changed later from Team.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
