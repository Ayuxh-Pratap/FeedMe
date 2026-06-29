"use client"

import { Check, ChevronDown, Copy, Link2, Mail, Ticket, X } from "lucide-react"
import { useMemo, useState, type ReactNode } from "react"

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

type InviteMemberDialogProps = {
  children: ReactNode
  workspaceName: string
  workspaceSlug: string
}

type InviteTab = "email" | "code"

const inviteRoles = ["Reporter", "Developer", "Designer", "Viewer"] as const
type InviteRole = (typeof inviteRoles)[number]

function inviteCodeFromSlug(workspaceSlug: string) {
  const normalized = workspaceSlug
    .replace(/[^a-z0-9]/gi, "")
    .slice(0, 4)
    .toUpperCase()
    .padEnd(4, "F")

  return `FM-${normalized}-7Q2K`
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
      className="relative h-9 sm:w-32"
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
        <span className="truncate">{role}</span>
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
            const selected = role === item

            return (
              <button
                key={item}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  onRoleChange(item)
                  setOpen(false)
                }}
                className={cn(
                  "flex h-8 w-full cursor-pointer items-center justify-between rounded-md px-2.5 text-left text-body-3 transition-colors duration-base ease-out-soft",
                  selected
                    ? "bg-surface-raised text-foreground shadow-button-hover"
                    : "text-text-body hover:bg-fill-subtle hover:text-foreground"
                )}
              >
                {item}
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
  const [activeTab, setActiveTab] = useState<InviteTab>("email")
  const [emails, setEmails] = useState("")
  const [role, setRole] = useState<InviteRole>("Reporter")
  const [copiedValue, setCopiedValue] = useState<"code" | "link" | null>(null)
  const inviteCode = useMemo(() => inviteCodeFromSlug(workspaceSlug), [workspaceSlug])
  const inviteLink = `https://feedme.test/join/${workspaceSlug}?code=${inviteCode}`
  const hasEmails = emails.trim().length > 0

  async function copyInvite(value: "code" | "link", text: string) {
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
              Share an invite by email or copy a role-scoped invite code.
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

        <div className="border-b border-border-hairline px-5">
          <div className="flex items-center gap-6">
            {([
              { icon: Mail, label: "Email", value: "email" },
              { icon: Ticket, label: "Invite code", value: "code" },
            ] as const).map((tab) => {
              const Icon = tab.icon
              const active = activeTab === tab.value

              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setActiveTab(tab.value)}
                  className={cn(
                    "relative flex h-10 cursor-pointer items-center gap-2 text-heading-5 transition-colors duration-base ease-out-soft active:scale-[var(--press-scale)]",
                    active
                      ? "text-foreground"
                      : "text-text-body hover:text-foreground"
                  )}
                >
                  <Icon className="size-4" />
                  {tab.label}
                  {active ? (
                    <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-primary-soft" />
                  ) : null}
                </button>
              )
            })}
          </div>
        </div>

        <div className="space-y-4 px-5 py-5">
          <div className="flex flex-col gap-2 sm:flex-row">
            {activeTab === "email" ? (
              <input
                aria-label="Invite emails"
                value={emails}
                onChange={(event) => setEmails(event.target.value)}
                placeholder="Enter emails, comma or space separated"
                className="h-9 min-w-0 flex-1 rounded-lg border border-border-subtle bg-background px-3 text-body-3 text-foreground outline-none transition-colors duration-base ease-out-soft placeholder:text-muted-foreground focus:border-border-strong"
              />
            ) : (
              <div className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border border-border-subtle bg-background px-3">
                <Ticket className="size-4 shrink-0 text-text-muted" />
                <span className="min-w-0 flex-1 truncate font-mono text-body-3 text-foreground">
                  {inviteCode}
                </span>
              </div>
            )}

            <RolePicker role={role} onRoleChange={setRole} />
          </div>

          {activeTab === "code" ? (
            <div className="rounded-lg border border-border-hairline bg-fill-translucent p-2.5">
              <p className="text-caption text-text-muted">Invite link</p>
              <p className="mt-1 truncate text-body-3 text-text-secondary">
                {inviteLink}
              </p>
            </div>
          ) : null}

          <div className="flex flex-col gap-2 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              disabled={!hasEmails}
              className={cn(
                "inline-flex h-8 cursor-pointer items-center justify-center rounded-lg border border-border-hairline bg-surface-raised px-3 text-heading-5 text-foreground shadow-button-hover transition-all duration-base ease-out-soft hover:border-border-strong hover:brightness-110 active:scale-[var(--press-scale)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-border-hairline disabled:hover:brightness-100",
                activeTab === "code" && "hidden"
              )}
            >
              Send invites
            </button>

            <div className="flex flex-col gap-2 sm:ml-auto sm:flex-row">
              <button
                type="button"
                onClick={() => copyInvite("code", inviteCode)}
                className="inline-flex h-8 cursor-pointer items-center justify-center gap-2 rounded-lg border border-border-hairline bg-fill-translucent px-3 text-heading-5 text-text-secondary shadow-button-secondary transition-all duration-base ease-out-soft hover:bg-fill-subtle hover:text-foreground hover:shadow-button-hover active:scale-[var(--press-scale)]"
              >
                {copiedValue === "code" ? (
                  <Check className="size-4" />
                ) : (
                  <Copy className="size-4" />
                )}
                {copiedValue === "code" ? "Copied code" : "Copy code"}
              </button>
              <button
                type="button"
                onClick={() => copyInvite("link", inviteLink)}
                className="inline-flex h-8 cursor-pointer items-center justify-center gap-2 rounded-lg border border-border-subtle bg-surface-raised px-3 text-heading-5 text-foreground shadow-button-hover transition-all duration-base ease-out-soft hover:border-border-strong hover:brightness-110 active:scale-[var(--press-scale)]"
              >
                {copiedValue === "link" ? (
                  <Check className="size-4" />
                ) : (
                  <Link2 className="size-4" />
                )}
                {copiedValue === "link" ? "Copied link" : "Copy invite link"}
              </button>
            </div>
          </div>

          <p className="text-caption text-text-muted">
            New members will join as {role.toLowerCase()}s unless their role is
            changed later from Team.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
