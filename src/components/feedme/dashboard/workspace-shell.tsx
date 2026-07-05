"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  ArrowUpRight,
  Bot,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  Code2,
  Download,
  Globe2,
  Grid2X2,
  Inbox,
  ListFilter,
  Loader2,
  LogOut,
  Maximize2,
  Menu,
  MessageSquare,
  MousePointer2,
  PanelRightClose,
  PanelRightOpen,
  Play,
  Plus,
  Search,
  Send,
  Settings2,
  Table2,
  UserRound,
  UserRoundCheck,
  UsersRound,
  X,
} from "lucide-react"
import {
  useCallback,
  useRef,
  useEffect,
  useState,
  useSyncExternalStore,
  type ComponentType,
  type ReactNode,
} from "react"

import type { MockWorkspace } from "@/lib/mock/dashboard"
import {
  getReportStatusLabel,
  type WorkspaceReport,
} from "@/lib/reports"
import {
  getWorkspaceMemberRoleLabel,
  type WorkspaceTeamMember,
} from "@/lib/team-members"
import { FeedMeAvatar } from "@/components/feedme/dashboard/feedme-avatar"
import {
  reportBadgeBaseClass,
  reportSeverityPillStyles,
  reportStatusPillStyles,
} from "@/components/feedme/dashboard/report-badge-styles"
import { ConnectAgentDialog } from "@/components/feedme/dashboard/connect-agent-dialog"
import { InviteMemberDialog } from "@/components/feedme/dashboard/invite-member-dialog"
import {
  useWorkspaceDashboardData,
  WorkspaceDashboardDataProvider,
} from "@/components/feedme/dashboard/workspace-dashboard-data"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import {
  ApiClientError,
  deleteJson,
  getJson,
  patchJson,
  postJson,
} from "@/lib/api-client"
import { replaceUrlSearchParams } from "@/lib/dashboard-url"

type WorkspaceShellProps = {
  availableWorkspaces: WorkspaceSwitcherOption[]
  children: ReactNode
  workspace: MockWorkspace
}

type WorkspaceSwitcherOption = {
  id: string
  name: string
  slug: string
  logoUrl: string | null
  role: "owner" | "admin" | "developer" | "designer" | "reporter" | "viewer"
}

type NavItem = {
  href: string
  icon: ComponentType<{ className?: string }>
  label: string
  planned?: boolean
}

type ReportScreenshot = WorkspaceReport["screenshots"][number]

type WorkspaceDomain = {
  id: string
  host: string
  status: "active" | "pending_verification" | "verified" | "disabled"
  verifiedAt: string | null
  createdAt: string
  updatedAt: string
}

type WorkspaceDomainsResponse = {
  domains: WorkspaceDomain[]
}

type WorkspaceDomainMutationResponse = {
  domain: WorkspaceDomain
}

type WorkspaceMembersResponse = {
  members: WorkspaceTeamMember[]
}

type ReportMutationResponse = {
  report: WorkspaceReport
}

const unassignedSelectValue = "__unassigned__"

const navItems: NavItem[] = [
  { href: "inbox", icon: Inbox, label: "Inbox", planned: true },
  { href: "reports", icon: ClipboardList, label: "Reports" },
  { href: "my-work", icon: UserRound, label: "My Work" },
  { href: "team", icon: UsersRound, label: "Team" },
]

const extensionCardDismissedKey = "feedme:extension-card-dismissed"
const extensionCardDismissedEvent = "feedme:extension-card-dismissed-change"
const extensionDownloadHref = "/downloads/feedme-extension.zip"
const chromeExtensionsUrl = "chrome://extensions"

function subscribeToExtensionCardDismissal(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange)
  window.addEventListener(extensionCardDismissedEvent, onStoreChange)

  return () => {
    window.removeEventListener("storage", onStoreChange)
    window.removeEventListener(extensionCardDismissedEvent, onStoreChange)
  }
}

function getExtensionCardDismissalSnapshot() {
  return window.localStorage.getItem(extensionCardDismissedKey) === "true"
}

function getServerExtensionCardDismissalSnapshot() {
  return false
}

function DashboardPrimaryButton({
  children,
  className,
  ariaLabel,
  onClick,
}: {
  children: ReactNode
  className?: string
  ariaLabel?: string
  onClick?: () => void
}) {
  return (
    <Button
      aria-label={ariaLabel}
      type="button"
      onClick={onClick}
      className={cn(
        "relative isolate h-8 overflow-hidden rounded-lg border-primary-soft/60 px-3.5 text-heading-5",
        "[background:var(--gradient-primary-premium)] text-primary-foreground shadow-[var(--elevation-primary-premium)]",
        "transition-all duration-base ease-out-soft hover:shadow-[var(--elevation-primary-premium-hover)]",
        "before:pointer-events-none before:absolute before:inset-0 before:z-0 before:opacity-0 before:[background:var(--gradient-primary-premium-hover)]",
        "before:transition-opacity before:duration-base before:ease-out-soft hover:before:opacity-100",
        "after:pointer-events-none after:absolute after:right-[10%] after:top-px after:z-[1] after:h-px after:w-[60%] after:[background:var(--gradient-button-glint)]",
        "active:scale-[var(--press-scale)] active:translate-y-0",
        className
      )}
    >
      <span className="relative z-10 inline-flex items-center gap-2">{children}</span>
    </Button>
  )
}

function IconButton({
  children,
  label,
  onClick,
  pressed,
}: {
  children: ReactNode
  label: string
  onClick?: () => void
  pressed?: boolean
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "flex size-8 cursor-pointer items-center justify-center rounded-lg border border-border-hairline",
        "bg-fill-translucent text-text-body shadow-button-secondary transition-all duration-base ease-out-soft",
        "hover:bg-fill-subtle hover:text-foreground hover:shadow-button-hover",
        pressed && "bg-fill-subtle text-foreground shadow-button-hover",
        "active:scale-[var(--press-scale)]"
      )}
    >
      {children}
    </button>
  )
}

function WorkspaceSwitcher({
  availableWorkspaces,
  workspace,
}: {
  availableWorkspaces: WorkspaceSwitcherOption[]
  workspace: MockWorkspace
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [switcherOpen, setSwitcherOpen] = useState(false)
  const [isSwitchDialogOpen, setIsSwitchDialogOpen] = useState(false)
  const [isDomainsDialogOpen, setIsDomainsDialogOpen] = useState(false)
  const [isConnectAgentOpen, setIsConnectAgentOpen] = useState(false)
  const switchCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const workspaceOptions =
    availableWorkspaces.length > 0
      ? availableWorkspaces.map((item) => ({
          name: item.name,
          slug: item.slug,
          current: item.slug === workspace.slug,
        }))
      : [{ name: workspace.name, slug: workspace.slug, current: true }]

  async function handleLogout() {
    await postJson<{ nextPath: string }>("/api/auth/logout")
    router.push("/login")
    router.refresh()
  }

  function clearSwitchCloseTimer() {
    if (switchCloseTimerRef.current) {
      clearTimeout(switchCloseTimerRef.current)
      switchCloseTimerRef.current = null
    }
  }

  function openWorkspaceSubmenu() {
    clearSwitchCloseTimer()
    setSwitcherOpen(true)
  }

  function scheduleWorkspaceSubmenuClose() {
    clearSwitchCloseTimer()
    switchCloseTimerRef.current = setTimeout(() => {
      setSwitcherOpen(false)
      switchCloseTimerRef.current = null
    }, 180)
  }

  return (
    <>
      <div
        className="relative"
        onBlur={(event) => {
          const nextTarget = event.relatedTarget

          if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) {
            setOpen(false)
            setSwitcherOpen(false)
          }
        }}
      >
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className="flex h-10 w-full cursor-pointer items-center gap-2 rounded-lg px-2 text-left text-foreground outline-none transition-all duration-base ease-out-soft hover:bg-fill-translucent focus:bg-fill-translucent"
        >
          <span
            className={cn(
              "relative isolate flex size-7 items-center justify-center overflow-hidden rounded-md border border-primary-soft/60",
              "[background:var(--gradient-primary-premium)] text-primary-foreground shadow-[var(--elevation-primary-premium)]",
              "after:pointer-events-none after:absolute after:right-[12%] after:top-px after:z-[1] after:h-px after:w-[62%] after:[background:var(--gradient-button-glint)]"
            )}
            aria-hidden="true"
          >
            <MessageSquare className="relative z-10 size-4" strokeWidth={2.4} />
          </span>
          <span className="min-w-0 flex-1 truncate text-heading-5 text-foreground">
            {workspace.name}
          </span>
          <ChevronDown
            className={cn(
              "size-4 text-muted-foreground transition-transform duration-base ease-out-soft",
              open && "rotate-180 text-text-secondary"
            )}
          />
        </button>

        {open ? (
          <div
            role="menu"
            className="absolute left-0 top-[calc(100%+0.375rem)] z-50 w-52 rounded-lg border border-border-hairline bg-surface-card p-1 text-foreground shadow-popover motion-safe:animate-[feedme-menu-in_180ms_var(--motion-out)_both]"
          >
            <WorkspaceMenuDisabledItem>
              <Settings2 className="size-4 text-text-muted" />
              <span className="min-w-0 flex-1 truncate">Settings</span>
              <span className="text-caption text-text-muted">Soon</span>
            </WorkspaceMenuDisabledItem>
            <WorkspaceMenuAction
              onClick={() => {
                setOpen(false)
                setSwitcherOpen(false)
                setIsDomainsDialogOpen(true)
              }}
            >
              <Globe2 className="size-4 text-text-muted" />
              Domains
            </WorkspaceMenuAction>
            <WorkspaceMenuAction
              onClick={() => {
                setOpen(false)
                setSwitcherOpen(false)
                setIsConnectAgentOpen(true)
              }}
            >
              <Bot className="size-4 text-text-muted" />
              Connect coding agent
            </WorkspaceMenuAction>

            <div
              className="relative"
              onMouseEnter={openWorkspaceSubmenu}
              onMouseLeave={scheduleWorkspaceSubmenuClose}
            >
              <button
                type="button"
                role="menuitem"
                aria-haspopup="menu"
                aria-expanded={switcherOpen}
                onClick={() => setSwitcherOpen((value) => !value)}
                className={cn(
                  "flex h-8 w-full cursor-pointer items-center gap-2 rounded-md px-2.5 text-left text-heading-5 transition-all duration-base ease-out-soft active:scale-[var(--press-scale)]",
                  switcherOpen
                    ? "bg-fill-subtle text-foreground shadow-button-hover"
                    : "text-text-body hover:bg-fill-subtle hover:text-foreground"
                )}
              >
                <span className="min-w-0 flex-1 truncate">Switch workspace</span>
                <ChevronRight className="size-4 text-text-muted" />
              </button>

              {switcherOpen ? (
                <>
                  <span
                    aria-hidden="true"
                    className="absolute left-full top-0 z-40 h-full w-2"
                  />
                  <div
                    role="menu"
                    onMouseEnter={openWorkspaceSubmenu}
                    onMouseLeave={scheduleWorkspaceSubmenuClose}
                    className="absolute left-[calc(100%+0.375rem)] top-0 z-50 w-64 rounded-lg border border-border-hairline bg-surface-card p-1 text-foreground shadow-popover motion-safe:animate-[feedme-menu-in_180ms_var(--motion-out)_both]"
                  >
                    {workspaceOptions.map((item) => (
                      <Link
                        key={item.slug}
                        href={`/${item.slug}/reports`}
                        role="menuitem"
                        className="flex h-8 cursor-pointer items-center gap-2 rounded-md px-2.5 text-heading-5 text-text-body transition-all duration-base ease-out-soft hover:bg-fill-subtle hover:text-foreground active:scale-[var(--press-scale)]"
                      >
                        <span className="min-w-0 flex-1 truncate">{item.name}</span>
                        {item.current ? (
                          <Check className="size-4 shrink-0 text-text-secondary" />
                        ) : null}
                      </Link>
                    ))}

                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setOpen(false)
                        setSwitcherOpen(false)
                        setIsSwitchDialogOpen(true)
                      }}
                      className="mt-1 flex h-8 w-full cursor-pointer items-center rounded-md px-2.5 text-left text-heading-5 text-foreground transition-all duration-base ease-out-soft hover:bg-fill-subtle active:scale-[var(--press-scale)]"
                    >
                      Create or join workspace...
                    </button>
                  </div>
                </>
              ) : null}
            </div>

            <WorkspaceMenuAction
              onClick={() => {
                void handleLogout()
              }}
            >
              <LogOut className="size-4 text-text-muted" />
              Log out
            </WorkspaceMenuAction>
          </div>
        ) : null}
      </div>

      <SwitchWorkspaceDialog
        open={isSwitchDialogOpen}
        onOpenChange={setIsSwitchDialogOpen}
        availableWorkspaces={availableWorkspaces}
        workspace={workspace}
      />
      <DomainsDialog
        open={isDomainsDialogOpen}
        onOpenChange={setIsDomainsDialogOpen}
        workspace={workspace}
      />
      <ConnectAgentDialog
        open={isConnectAgentOpen}
        onOpenChange={setIsConnectAgentOpen}
        workspace={workspace}
      />
    </>
  )
}

function WorkspaceMenuAction({
  children,
  onClick,
}: {
  children: ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex h-8 w-full cursor-pointer items-center gap-2 rounded-md px-2.5 text-left text-heading-5 text-text-body transition-all duration-base ease-out-soft hover:bg-fill-subtle hover:text-foreground active:scale-[var(--press-scale)]"
    >
      {children}
    </button>
  )
}

function WorkspaceMenuDisabledItem({ children }: { children: ReactNode }) {
  return (
    <div
      aria-disabled="true"
      role="menuitem"
      className="flex h-8 items-center gap-2 rounded-md px-2.5 text-heading-5 text-text-muted"
    >
      {children}
    </div>
  )
}

function SwitchWorkspaceDialog({
  availableWorkspaces,
  onOpenChange,
  open,
  workspace,
}: {
  availableWorkspaces: WorkspaceSwitcherOption[]
  onOpenChange: (open: boolean) => void
  open: boolean
  workspace: MockWorkspace
}) {
  const workspaceOptions =
    availableWorkspaces.length > 0
      ? availableWorkspaces.map((item) => ({
          name: item.name,
          slug: item.slug,
          current: item.slug === workspace.slug,
        }))
      : [{ name: workspace.name, slug: workspace.slug, current: true }]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="w-[min(calc(100vw-2rem),520px)] !max-w-[min(calc(100vw-2rem),520px)] gap-0 overflow-hidden rounded-xl border border-border-hairline bg-surface-card p-0 text-foreground shadow-popover sm:!max-w-[min(calc(100vw-2rem),520px)]"
      >
        <div className="flex items-start justify-between gap-4 px-5 pb-4 pt-5">
          <div>
            <DialogTitle className="text-heading-3 text-foreground">
              Select a workspace
            </DialogTitle>
            <DialogDescription className="mt-1 text-body-3 text-text-body">
              Choose an existing workspace or create a new one.
            </DialogDescription>
          </div>
          <button
            type="button"
            aria-label="Close workspace switcher"
            onClick={() => onOpenChange(false)}
            className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-border-hairline bg-fill-translucent text-text-body shadow-button-secondary transition-all duration-base ease-out-soft hover:bg-fill-subtle hover:text-foreground hover:shadow-button-hover active:scale-[var(--press-scale)]"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-3 px-5 py-5">
          <div className="space-y-2">
            {workspaceOptions.map((item) => (
              <Link
                key={item.slug}
                href={`/${item.slug}/reports`}
                onClick={() => onOpenChange(false)}
                className="flex h-10 cursor-pointer items-center gap-3 rounded-lg border border-border-subtle bg-fill-translucent px-3 text-heading-5 text-foreground shadow-button-secondary transition-all duration-base ease-out-soft hover:bg-fill-subtle hover:shadow-button-hover active:scale-[var(--press-scale)]"
              >
                <span className="min-w-0 flex-1 truncate">{item.name}</span>
                {item.current ? (
                  <Check className="size-4 text-text-secondary" />
                ) : null}
              </Link>
            ))}
          </div>

          {workspaceOptions.length === 1 ? (
            <p className="py-4 text-center text-body-2 text-text-body">
              No other workspaces available yet.
            </p>
          ) : null}

          <Link
            href="/workspaces/new"
            onClick={() => onOpenChange(false)}
            className="relative isolate flex h-10 cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-lg border border-border-subtle bg-surface-raised px-3 text-heading-5 text-foreground shadow-button-hover transition-all duration-base ease-out-soft hover:border-border-strong hover:brightness-110 active:scale-[var(--press-scale)]"
          >
            <Plus className="size-4" />
            Create new workspace
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function DomainsDialog({
  onOpenChange,
  open,
  workspace,
}: {
  onOpenChange: (open: boolean) => void
  open: boolean
  workspace: MockWorkspace
}) {
  const [domains, setDomains] = useState<WorkspaceDomain[]>([])
  const [newDomain, setNewDomain] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [deletingDomainId, setDeletingDomainId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const domainsEndpoint = `/api/workspaces/${encodeURIComponent(workspace.slug)}/domains`

  useEffect(() => {
    let isMounted = true

    async function loadDomains() {
      setIsLoading(true)
      setErrorMessage(null)

      try {
        const result = await getJson<WorkspaceDomainsResponse>(domainsEndpoint)

        if (isMounted) {
          setDomains(result.domains)
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(
            error instanceof ApiClientError
              ? error.message
              : "Unable to load domains. Please try again."
          )
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    if (open) {
      void loadDomains()
    }

    return () => {
      isMounted = false
    }
  }, [domainsEndpoint, open])

  async function addDomain() {
    const value = newDomain.trim()

    if (!value) {
      return
    }

    setIsSaving(true)
    setErrorMessage(null)

    try {
      const result = await postJson<WorkspaceDomainMutationResponse>(domainsEndpoint, {
        domain: value,
      })

      setDomains((items) => [...items, result.domain])
      setNewDomain("")
    } catch (error) {
      setErrorMessage(
        error instanceof ApiClientError
          ? error.message
          : "Unable to add domain. Please try again."
      )
    } finally {
      setIsSaving(false)
    }
  }

  async function removeDomain(domainId: string) {
    setDeletingDomainId(domainId)
    setErrorMessage(null)

    try {
      await deleteJson<WorkspaceDomainMutationResponse>(
        `${domainsEndpoint}/${encodeURIComponent(domainId)}`
      )

      setDomains((items) => items.filter((item) => item.id !== domainId))
    } catch (error) {
      setErrorMessage(
        error instanceof ApiClientError
          ? error.message
          : "Unable to remove domain. Please try again."
      )
    } finally {
      setDeletingDomainId(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="w-[min(calc(100vw-2rem),600px)] !max-w-[min(calc(100vw-2rem),600px)] gap-0 overflow-hidden rounded-xl border border-border-hairline bg-surface-card p-0 text-foreground shadow-popover sm:!max-w-[min(calc(100vw-2rem),600px)]"
      >
        <div className="flex items-start justify-between gap-4 px-5 pb-4 pt-5">
          <div>
            <DialogTitle className="text-heading-3 text-foreground">
              Domains
            </DialogTitle>
            <DialogDescription className="mt-1 text-body-3 text-text-body">
              Control where the FeedMe extension can capture feedback for {workspace.name}.
            </DialogDescription>
            <p className="mt-2 text-caption text-text-muted">
              {domains.length}/5 domains connected
            </p>
          </div>
          <button
            type="button"
            aria-label="Close domains dialog"
            onClick={() => onOpenChange(false)}
            className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-border-hairline bg-fill-translucent text-text-body shadow-button-secondary transition-all duration-base ease-out-soft hover:bg-fill-subtle hover:text-foreground hover:shadow-button-hover active:scale-[var(--press-scale)]"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          <div className="space-y-2">
            {isLoading ? (
              <div className="rounded-lg border border-border-hairline bg-fill-translucent px-3 py-4 text-center text-body-3 text-text-body">
                Loading domains...
              </div>
            ) : null}

            {!isLoading && domains.length === 0 ? (
              <div className="rounded-lg border border-border-hairline bg-fill-translucent px-3 py-4 text-center text-body-3 text-text-body">
                No domains connected yet.
              </div>
            ) : null}

            {!isLoading
              ? domains.map((item) => (
                  <div
                    key={item.id}
                    className="flex min-h-10 items-center gap-3 rounded-lg border border-border-hairline bg-fill-translucent px-3 py-2"
                  >
                    <Globe2 className="size-4 shrink-0 text-text-muted" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-heading-5 text-foreground">
                        {item.host}
                      </p>
                      <p className="mt-0.5 text-caption text-text-muted">
                        {item.status === "active"
                          ? "Extension capture enabled"
                          : "Verification pending"}
                      </p>
                    </div>
                    <span className="rounded-md border border-border-hairline bg-fill-subtle px-1.5 py-0.5 text-caption capitalize text-text-secondary">
                      {labelFromToken(item.status)}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        void removeDomain(item.id)
                      }}
                      disabled={deletingDomainId === item.id || isSaving}
                      className="flex h-7 cursor-pointer items-center rounded-md border border-border-hairline bg-fill-translucent px-2 text-caption text-text-body shadow-button-secondary transition-all duration-base ease-out-soft hover:bg-fill-subtle hover:text-foreground active:scale-[var(--press-scale)] disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      {deletingDomainId === item.id ? "Removing" : "Remove"}
                    </button>
                  </div>
                ))
              : null}
          </div>

          {errorMessage ? (
            <div
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-body-3 font-medium text-destructive"
            >
              {errorMessage}
            </div>
          ) : null}

          <form
            className="flex flex-col gap-2 border-t border-border-hairline pt-4 sm:flex-row"
            onSubmit={(event) => {
              event.preventDefault()
              void addDomain()
            }}
          >
            <div className="min-w-0 flex-1">
              <input
                aria-label="New domain"
                value={newDomain}
                onChange={(event) => setNewDomain(event.target.value)}
                placeholder="yourdomain.com"
                disabled={isSaving || isLoading || domains.length >= 5}
                className="h-9 w-full min-w-0 rounded-lg border border-border-subtle bg-background px-3 text-body-3 text-foreground outline-none transition-colors duration-base ease-out-soft placeholder:text-muted-foreground focus:border-border-strong disabled:cursor-not-allowed disabled:opacity-55"
              />
              <p className="mt-1 text-caption text-text-muted">
                Exact domains only. Subdomains are added separately.
              </p>
            </div>
            <button
              type="submit"
              disabled={
                !newDomain.trim() || isSaving || isLoading || domains.length >= 5
              }
              className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-lg border border-border-subtle bg-surface-raised px-3 text-heading-5 text-foreground shadow-button-hover transition-all duration-base ease-out-soft hover:border-border-strong hover:brightness-110 active:scale-[var(--press-scale)] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:border-border-subtle disabled:hover:brightness-100"
            >
              <Plus className="size-4" />
              {isSaving ? "Adding" : "Add domain"}
            </button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ExtensionInstallDialog({
  onOpenChange,
  open,
}: {
  onOpenChange: (open: boolean) => void
  open: boolean
}) {
  const [copied, setCopied] = useState(false)

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setCopied(false)
    }

    onOpenChange(nextOpen)
  }

  async function copyChromeUrl() {
    try {
      await navigator.clipboard.writeText(chromeExtensionsUrl)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="w-[min(calc(100vw-2rem),560px)] !max-w-[min(calc(100vw-2rem),560px)] gap-0 overflow-hidden rounded-xl border border-border-hairline bg-surface-card p-0 text-foreground shadow-popover sm:!max-w-[min(calc(100vw-2rem),560px)]"
      >
        <div className="flex items-start justify-between gap-4 px-5 pb-4 pt-5">
          <div className="min-w-0">
            <div className="mb-3 flex size-9 items-center justify-center rounded-lg border border-primary-soft/60 [background:var(--gradient-primary-premium)] text-primary-foreground shadow-[var(--elevation-primary-premium)]">
              <Download className="size-4" />
            </div>
            <DialogTitle className="text-heading-3 text-foreground">
              Install FeedMe extension
            </DialogTitle>
            <DialogDescription className="mt-1 text-body-3 text-text-body">
              Download the Chrome package and load it manually while the Web Store
              listing is not published.
            </DialogDescription>
          </div>
          <button
            type="button"
            aria-label="Close extension install dialog"
            onClick={() => handleOpenChange(false)}
            className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-border-hairline bg-fill-translucent text-text-body shadow-button-secondary transition-all duration-base ease-out-soft hover:bg-fill-subtle hover:text-foreground hover:shadow-button-hover active:scale-[var(--press-scale)]"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-4 border-t border-border-hairline px-5 py-5">
          <ol className="grid gap-2">
            {[
              "Download the ZIP and unzip it on your computer.",
              "Open chrome://extensions and turn on Developer mode.",
              "Click Load unpacked and choose the unzipped chrome-mv3 folder.",
            ].map((step, index) => (
              <li
                key={step}
                className="flex min-h-10 items-center gap-3 rounded-lg border border-border-hairline bg-fill-translucent px-3 py-2 text-body-3 text-text-body"
              >
                <span className="flex size-6 shrink-0 items-center justify-center rounded-md border border-border-subtle bg-fill-subtle text-caption font-semibold text-foreground">
                  {index + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>

          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
            <a
              href={extensionDownloadHref}
              download
              className="relative isolate flex h-10 cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-lg border border-primary-soft/60 px-3 text-heading-5 text-primary-foreground shadow-[var(--elevation-primary-premium)] transition-all duration-base ease-out-soft [background:var(--gradient-primary-premium)] hover:shadow-[var(--elevation-primary-premium-hover)] active:scale-[var(--press-scale)]"
            >
              <Download className="size-4" />
              Download extension ZIP
            </a>
            <button
              type="button"
              onClick={() => {
                void copyChromeUrl()
              }}
              className="flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-border-subtle bg-surface-raised px-3 text-heading-5 text-foreground shadow-button-hover transition-all duration-base ease-out-soft hover:border-border-strong hover:brightness-110 active:scale-[var(--press-scale)]"
            >
              {copied ? <Check className="size-4" /> : <ClipboardList className="size-4" />}
              {copied ? "Copied" : "Copy Chrome URL"}
            </button>
          </div>

          <p className="rounded-lg border border-border-hairline bg-fill-translucent px-3 py-2 text-caption text-text-muted">
            Chrome does not allow a normal website to install an unpublished
            extension in one click. This keeps the MVP honest until FeedMe gets
            a Chrome Web Store listing.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function SidebarNav({
  closeLinks,
  workspaceSlug,
}: {
  closeLinks?: boolean
  workspaceSlug: string
}) {
  const pathname = usePathname()

  return (
    <nav className="mt-4 space-y-1">
      {navItems.map((item) => {
        const Icon = item.icon
        const href = `/${workspaceSlug}/${item.href}`
        const active = pathname === href || pathname.startsWith(`${href}/`)
        const content = (
          <>
            <Icon className="size-4" />
            <span className="truncate">{item.label}</span>
          </>
        )

        if (item.planned) {
          return (
            <span
              key={item.href}
              aria-disabled="true"
              className="flex h-8 items-center gap-2 rounded-lg px-2.5 text-heading-5 text-text-muted"
            >
              {content}
              <span className="ml-auto text-caption text-text-muted">Soon</span>
            </span>
          )
        }

        return (
          closeLinks ? (
            <SheetClose asChild key={item.href}>
              <Link
                href={href}
                className={cn(
                  "flex h-8 cursor-pointer items-center gap-2 rounded-lg px-2.5 text-heading-5 transition-all duration-base ease-out-soft",
                  active
                    ? "[background:var(--fill-nav-active)] text-foreground shadow-nav-active"
                    : "text-text-body hover:bg-fill-translucent hover:text-foreground"
                )}
              >
                {content}
              </Link>
            </SheetClose>
          ) : (
            <Link
              key={item.href}
              href={href}
              className={cn(
                "flex h-8 cursor-pointer items-center gap-2 rounded-lg px-2.5 text-heading-5 transition-all duration-base ease-out-soft",
                active
                  ? "[background:var(--fill-nav-active)] text-foreground shadow-nav-active"
                  : "text-text-body hover:bg-fill-translucent hover:text-foreground"
              )}
            >
              {content}
            </Link>
          )
        )
      })}
    </nav>
  )
}

function ExtensionCard({ onInstall }: { onInstall: () => void }) {
  const dismissed = useSyncExternalStore(
    subscribeToExtensionCardDismissal,
    getExtensionCardDismissalSnapshot,
    getServerExtensionCardDismissalSnapshot
  )

  function dismissCard() {
    window.localStorage.setItem(extensionCardDismissedKey, "true")
    window.dispatchEvent(new Event(extensionCardDismissedEvent))
  }

  if (dismissed) {
    return null
  }

  return (
    <section className="relative isolate overflow-hidden rounded-lg border border-border-hairline p-2.5 [background:var(--fill-nav-active)] shadow-nav-active">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-px bg-gradient-to-r from-transparent via-white/18 to-transparent" />

      <div className="flex items-start gap-2">
        <h2 className="min-w-0 flex-1 text-heading-5 text-foreground">
          Install the FeedMe Browser Extension
        </h2>
        <button
          type="button"
          aria-label="Dismiss extension card"
          onClick={dismissCard}
          className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-text-muted transition-all duration-base ease-out-soft hover:bg-fill-subtle hover:text-foreground active:scale-[var(--press-scale)]"
        >
          <X className="size-3.5" />
        </button>
      </div>

      <p className="mt-2 text-body-3 text-text-body">
        Capture feedback on any website in one click.
      </p>

      <button
        type="button"
        onClick={onInstall}
        className="mt-3 flex h-8 w-full cursor-pointer items-center justify-center rounded-md border border-border-subtle bg-surface-raised text-heading-5 text-foreground shadow-button-hover transition-all duration-base ease-out-soft hover:border-border-strong hover:brightness-110 active:scale-[var(--press-scale)]"
      >
        Download extension
      </button>
    </section>
  )
}

function SidebarInviteButton({ workspace }: { workspace: MockWorkspace }) {
  return (
    <InviteMemberDialog
      workspaceName={workspace.name}
      workspaceSlug={workspace.slug}
    >
      <button
        type="button"
        className="flex h-8 w-full cursor-pointer items-center justify-center gap-1.5 rounded-md border border-border-subtle bg-surface-raised text-heading-5 text-foreground shadow-button-hover transition-all duration-base ease-out-soft hover:border-border-strong hover:brightness-110 active:scale-[var(--press-scale)]"
      >
        <Plus className="size-3.5" />
        Invite member
      </button>
    </InviteMemberDialog>
  )
}

function WorkspaceSidebar({
  availableWorkspaces,
  onOpenExtensionInstall,
  workspace,
}: {
  availableWorkspaces: WorkspaceSwitcherOption[]
  onOpenExtensionInstall: () => void
  workspace: MockWorkspace
}) {
  return (
    <aside className="hidden h-screen w-sidebar shrink-0 flex-col bg-card p-2.5 lg:flex">
      <WorkspaceSwitcher
        availableWorkspaces={availableWorkspaces}
        workspace={workspace}
      />
      <SidebarNav workspaceSlug={workspace.slug} />

      <div className="mt-auto space-y-2">
        <SidebarInviteButton workspace={workspace} />
        <ExtensionCard onInstall={onOpenExtensionInstall} />
      </div>
    </aside>
  )
}

function MobileNavSheet({
  availableWorkspaces,
  onOpenExtensionInstall,
  workspace,
}: {
  availableWorkspaces: WorkspaceSwitcherOption[]
  onOpenExtensionInstall: () => void
  workspace: MockWorkspace
}) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <IconButton label="Open navigation">
          <Menu className="size-4" />
        </IconButton>
      </SheetTrigger>
      <SheetContent
        side="left"
        showCloseButton={false}
        className="!w-[min(21rem,calc(100vw-1.5rem))] !max-w-none border-border-hairline bg-card p-3 text-foreground shadow-popover"
      >
        <SheetTitle className="sr-only">Workspace navigation</SheetTitle>
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <WorkspaceSwitcher
              availableWorkspaces={availableWorkspaces}
              workspace={workspace}
            />
          </div>
          <SheetClose asChild>
            <button
              type="button"
              aria-label="Close navigation"
              className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-border-hairline bg-fill-translucent text-text-body shadow-button-secondary transition-all duration-base ease-out-soft hover:bg-fill-subtle hover:text-foreground hover:shadow-button-hover active:scale-[var(--press-scale)]"
            >
              <X className="size-4" />
            </button>
          </SheetClose>
        </div>

        <SidebarNav closeLinks workspaceSlug={workspace.slug} />

        <div className="mt-auto">
          <div className="mb-2">
            <SidebarInviteButton workspace={workspace} />
          </div>
          <ExtensionCard onInstall={onOpenExtensionInstall} />
        </div>
      </SheetContent>
    </Sheet>
  )
}

function DashboardSearchInput({
  autoFocus,
  placeholder,
  showIcon,
}: {
  autoFocus?: boolean
  placeholder: string
  showIcon?: boolean
}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { setDashboardSearchQuery } = useWorkspaceDashboardData()
  const urlSearchValue = searchParams.get("q") ?? ""
  const [draftSearchValue, setDraftSearchValue] = useState(urlSearchValue)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const committedSearchValueRef = useRef(urlSearchValue)
  const latestPathnameRef = useRef(pathname)
  const latestSearchParamsRef = useRef(searchParams)

  useEffect(() => {
    latestPathnameRef.current = pathname
    latestSearchParamsRef.current = searchParams
  }, [pathname, searchParams])

  useEffect(() => {
    if (urlSearchValue === committedSearchValueRef.current) {
      return
    }

    const syncTimer = setTimeout(() => {
      committedSearchValueRef.current = urlSearchValue
      setDraftSearchValue(urlSearchValue)
    }, 0)

    return () => clearTimeout(syncTimer)
  }, [urlSearchValue])

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [])

  function commitSearch(nextValue: string) {
    const nextSearchParams = new URLSearchParams(
      latestSearchParamsRef.current.toString()
    )
    const normalizedValue = nextValue.trim()

    if (normalizedValue) {
      nextSearchParams.set("q", normalizedValue)
    } else {
      nextSearchParams.delete("q")
    }

    nextSearchParams.delete("report")
    nextSearchParams.delete("member")

    const nextPathname = latestPathnameRef.current

    committedSearchValueRef.current = normalizedValue
    setDashboardSearchQuery(normalizedValue)
    replaceUrlSearchParams(nextPathname, nextSearchParams)
  }

  function scheduleSearch(nextValue: string) {
    setDraftSearchValue(nextValue)

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    debounceTimerRef.current = setTimeout(() => {
      commitSearch(nextValue)
      debounceTimerRef.current = null
    }, 240)
  }

  function clearSearch() {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }

    setDraftSearchValue("")
    commitSearch("")
  }

  return (
    <div
      className={cn(
        "flex min-w-0 flex-1 items-center gap-2 rounded-lg border transition-colors duration-base ease-out-soft",
        showIcon
          ? "h-10 border-border-subtle bg-background px-3"
          : "h-8 border-transparent bg-transparent px-2"
      )}
    >
      {showIcon ? (
        <Search className="size-4 shrink-0 text-muted-foreground" />
      ) : null}
      <input
        aria-label="Search reports, domains, people"
        autoFocus={autoFocus}
        value={draftSearchValue}
        onChange={(event) => scheduleSearch(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape" && draftSearchValue) {
            event.preventDefault()
            clearSearch()
          }

          if (event.key === "Enter") {
            if (debounceTimerRef.current) {
              clearTimeout(debounceTimerRef.current)
              debounceTimerRef.current = null
            }

            commitSearch(draftSearchValue)
          }
        }}
        className="h-full min-w-0 flex-1 border-0 bg-transparent text-body-2 text-foreground outline-none placeholder:text-muted-foreground"
        placeholder={placeholder}
      />
      {draftSearchValue ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={clearSearch}
          className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-text-muted transition-all duration-base ease-out-soft hover:bg-fill-subtle hover:text-foreground active:scale-[var(--press-scale)]"
        >
          <X className="size-3.5" />
        </button>
      ) : null}
    </div>
  )
}

function MobileSearchSheet({ workspace }: { workspace: MockWorkspace }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <IconButton label="Search reports, domains, people">
          <Search className="size-4" />
        </IconButton>
      </SheetTrigger>
      <SheetContent
        side="top"
        showCloseButton={false}
        className="border-border-hairline bg-card p-3 text-foreground shadow-popover"
      >
        <SheetTitle className="sr-only">Search FeedMe</SheetTitle>
        <div className="mx-auto flex w-full max-w-2xl items-center gap-2">
          <DashboardSearchInput
            autoFocus
            placeholder={`Search ${workspace.name}...`}
            showIcon
          />
          <SheetClose asChild>
            <button
              type="button"
              className="flex h-10 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-border-hairline bg-fill-translucent px-3 text-heading-5 text-text-body shadow-button-secondary transition-all duration-base ease-out-soft hover:bg-fill-subtle hover:text-foreground hover:shadow-button-hover active:scale-[var(--press-scale)]"
            >
              Cancel
            </button>
          </SheetClose>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function ReportViewToggle({ workspaceSlug }: { workspaceSlug: string }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const reportsPath = `/${workspaceSlug}/reports`
  const myWorkPath = `/${workspaceSlug}/my-work`
  const supportsViewSwitch = pathname === reportsPath || pathname === myWorkPath
  const isGridView = searchParams.get("view") === "grid"

  if (!supportsViewSwitch) {
    return (
      <IconButton label="Help">
        <CircleHelp className="size-4" />
      </IconButton>
    )
  }

  function toggleView() {
    const nextSearchParams = new URLSearchParams(searchParams.toString())

    if (isGridView) {
      nextSearchParams.delete("view")
    } else {
      nextSearchParams.set("view", "grid")
    }

    replaceUrlSearchParams(pathname, nextSearchParams)
  }

  return (
    <IconButton
      label={isGridView ? "Switch to table view" : "Switch to grid view"}
      onClick={toggleView}
      pressed={isGridView}
    >
      {isGridView ? (
        <Table2 className="size-4" />
      ) : (
        <Grid2X2 className="size-4" />
      )}
    </IconButton>
  )
}

function WorkspaceTopbar({
  availableWorkspaces,
  isRightRailOpen,
  isRightRailEnabled,
  onOpenExtensionInstall,
  onToggleRightRail,
  onReportChange,
  reportRailIsLoading,
  reportRailMembers,
  reportRailMembersErrorMessage,
  reportRailMembersIsLoading,
  reportRailReports,
  reportRailSelectedReportId,
  workspace,
}: {
  availableWorkspaces: WorkspaceSwitcherOption[]
  isRightRailOpen: boolean
  isRightRailEnabled: boolean
  onOpenExtensionInstall: () => void
  onToggleRightRail: () => void
  onReportChange?: (report: WorkspaceReport) => void
  reportRailIsLoading?: boolean
  reportRailMembers?: WorkspaceTeamMember[]
  reportRailMembersErrorMessage?: string | null
  reportRailMembersIsLoading?: boolean
  reportRailReports?: WorkspaceReport[]
  reportRailSelectedReportId?: string | null
  workspace: MockWorkspace
}) {
  return (
    <>
      <header className="hidden h-topbar shrink-0 items-center justify-between border-b border-border-hairline bg-fill-translucent px-4 lg:flex">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Search className="size-5 text-muted-foreground" />
          <div className="flex items-center gap-1 rounded-md bg-fill-subtle px-2 py-1 text-body-3 text-text-secondary">
            <FeedMeAvatar
              className="border-border-subtle shadow-none"
              displayValue={workspace.user.initials}
              imageUrl={workspace.user.avatarUrl}
              label={workspace.user.displayName}
              size={16}
              value={workspace.user.email ?? workspace.user.displayName}
            />
            {workspace.user.displayName}
          </div>
          <DashboardSearchInput placeholder="Search reports, domains, people..." />
        </div>

        <div className="flex items-center gap-2 pl-4">
          <DashboardPrimaryButton onClick={onOpenExtensionInstall}>
            <Camera className="size-4" />
            Capture report
          </DashboardPrimaryButton>
          <ReportViewToggle workspaceSlug={workspace.slug} />
          {isRightRailEnabled ? (
            <IconButton
              label={isRightRailOpen ? "Hide details panel" : "Show details panel"}
              onClick={onToggleRightRail}
              pressed={isRightRailOpen}
            >
              {isRightRailOpen ? (
                <PanelRightClose className="size-4" />
              ) : (
                <PanelRightOpen className="size-4" />
              )}
            </IconButton>
          ) : null}
        </div>
      </header>

      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border-hairline bg-fill-translucent px-3 lg:hidden">
        <div className="flex min-w-0 items-center gap-2">
          <MobileNavSheet
            availableWorkspaces={availableWorkspaces}
            onOpenExtensionInstall={onOpenExtensionInstall}
            workspace={workspace}
          />
          <span className="min-w-0 truncate text-heading-5 text-foreground">
            {workspace.name}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-2 pl-3">
          <MobileSearchSheet workspace={workspace} />
          <DashboardPrimaryButton
            ariaLabel="Capture report"
            className="px-3 sm:px-4"
            onClick={onOpenExtensionInstall}
          >
            <Camera className="size-4" />
            <span className="sr-only sm:not-sr-only">Capture</span>
          </DashboardPrimaryButton>
          {isRightRailEnabled ? (
            <MobileRightRailSheet
              onReportChange={onReportChange}
              reportRailIsLoading={reportRailIsLoading}
              reportRailMembers={reportRailMembers}
              reportRailMembersErrorMessage={reportRailMembersErrorMessage}
              reportRailMembersIsLoading={reportRailMembersIsLoading}
              reportRailReports={reportRailReports}
              reportRailSelectedReportId={reportRailSelectedReportId}
              workspace={workspace}
            />
          ) : null}
        </div>
      </header>
    </>
  )
}

function WorkspaceRightRailContent({
  className,
  onReportChange,
  reportRailIsLoading,
  reportRailMembers,
  reportRailMembersErrorMessage,
  reportRailMembersIsLoading,
  reportRailReports,
  reportRailSelectedReportId,
  workspace,
}: {
  className?: string
  onReportChange?: (report: WorkspaceReport) => void
  reportRailIsLoading?: boolean
  reportRailMembers?: WorkspaceTeamMember[]
  reportRailMembersErrorMessage?: string | null
  reportRailMembersIsLoading?: boolean
  reportRailReports?: WorkspaceReport[]
  reportRailSelectedReportId?: string | null
  workspace: MockWorkspace
}) {
  const pathname = usePathname()
  const reportsPath = `/${workspace.slug}/reports`
  const myWorkPath = `/${workspace.slug}/my-work`
  const teamPath = `/${workspace.slug}/team`
  const isReportsRoute = pathname === reportsPath
  const isMyWorkRoute = pathname === myWorkPath
  const isReportInspectorRoute = isReportsRoute || isMyWorkRoute
  const isTeamRoute = pathname === teamPath

  if (isReportInspectorRoute) {
    return (
      <ReportsContextRail
        className={className}
        isLoading={Boolean(reportRailIsLoading)}
        members={reportRailMembers ?? []}
        membersErrorMessage={reportRailMembersErrorMessage ?? null}
        membersIsLoading={Boolean(reportRailMembersIsLoading)}
        onReportChange={onReportChange ?? (() => undefined)}
        reports={reportRailReports ?? []}
        selectedReportId={reportRailSelectedReportId ?? null}
        workspace={workspace}
      />
    )
  }

  if (isTeamRoute) {
    return <TeamContextRail className={className} />
  }

  return (
    <div className={cn("feedme-scrollbar-hidden h-full w-right-rail overflow-y-auto", className)}>
      <section className="border-b border-border-hairline px-5 py-6 text-center">
        <FeedMeAvatar
          className="mx-auto border-border-subtle shadow-[var(--elevation-primary-premium)]"
          displayValue={workspace.user.initials}
          imageUrl={workspace.user.avatarUrl}
          label={workspace.user.displayName}
          size={56}
          value={workspace.user.email ?? workspace.user.displayName}
        />
        <h2 className="mt-3 text-heading-3 text-foreground">
          {workspace.user.displayName}
        </h2>
        <p className="mt-1 text-body-2 text-text-body">{workspace.user.title}</p>

        <div className="mt-5 grid grid-cols-3 gap-2">
          {workspace.stats.map((stat) => (
            <div key={stat.label}>
              <p className="text-heading-5 text-foreground">{stat.value}</p>
              <p className="mt-0.5 text-caption text-text-body">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="px-5 py-4">
        <div className="flex items-center gap-2 text-body-3 text-text-muted">
          <ListFilter className="size-4" />
          Ready to triage
        </div>
        <div className="mt-4 space-y-3">
          <span className="block h-3 w-full rounded-full bg-fill-translucent" />
          <span className="block h-3 w-4/5 rounded-full bg-fill-translucent" />
          <span className="block h-3 w-3/5 rounded-full bg-fill-translucent" />
        </div>
      </section>
    </div>
  )
}

function labelFromToken(token: string) {
  return token.replace(/_/g, " ")
}

function ReportRailBadge({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        reportBadgeBaseClass,
        className
      )}
    >
      {children}
    </span>
  )
}

function ReportRailMeta({
  label,
  value,
}: {
  label: string
  value: ReactNode
}) {
  return (
    <div className="rounded-lg border border-border-hairline bg-fill-translucent px-2.5 py-2">
      <p className="text-caption text-text-muted">{label}</p>
      <div className="mt-1 truncate text-body-3 text-text-secondary">{value}</div>
    </div>
  )
}

function getScreenshotDimensions(
  report: WorkspaceReport,
  screenshot: ReportScreenshot
) {
  if (screenshot.width && screenshot.height) {
    return {
      width: screenshot.width,
      height: screenshot.height,
    }
  }

  const match = report.viewport.match(/(\d+)\s*x\s*(\d+)/i)
  const width = match ? Number(match[1]) : 1440
  const height = match ? Number(match[2]) : 900

  if (screenshot.kind === "page") {
    return { width, height }
  }

  return {
    width: Math.max(320, Math.round(width * 0.42)),
    height: Math.max(220, Math.round(height * 0.34)),
  }
}

function ReportEvidenceFrame({
  label,
  kind,
  className,
  url,
  thumbnailUrl,
  preferThumbnail,
}: ReportScreenshot & { className?: string; preferThumbnail?: boolean }) {
  const [loaded, setLoaded] = useState(false)
  // Small surfaces (rail) use the optimized thumbnail; the fullscreen viewer
  // asks for the full-resolution original.
  const source = preferThumbnail ? thumbnailUrl ?? url : url

  if (source) {
    return (
      <div className={cn("relative overflow-hidden bg-surface-card", className)}>
        <Image
          src={source}
          alt={`${label} screenshot evidence`}
          fill
          unoptimized
          sizes="(min-width: 1024px) 288px, 100vw"
          onLoad={() => setLoaded(true)}
          className={cn(
            "object-contain transition-opacity duration-500 ease-out",
            loaded ? "opacity-100" : "opacity-0"
          )}
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-[linear-gradient(0deg,color-mix(in_srgb,var(--surface-divider)_78%,transparent),transparent)]" />
        <p className="pointer-events-none absolute bottom-3 left-3 truncate text-caption text-text-secondary">
          {label}
        </p>
      </div>
    )
  }

  return (
    <div className={cn("relative overflow-hidden bg-surface-card", className)}>
      <div className="absolute inset-0 [background:linear-gradient(145deg,var(--surface-raised),var(--surface-shell))]" />
      <div className="absolute left-3 right-3 top-3 h-4 rounded border border-border-hairline bg-background/70" />
      <div className="absolute left-3 top-10 h-9 w-24 rounded-lg border border-border-hairline bg-fill-subtle" />
      <div className="absolute bottom-4 left-3 right-3 h-9 rounded-lg border border-border-hairline bg-background/70" />
      {kind === "annotated" ? (
        <>
          <div className="absolute bottom-8 left-6 right-5 h-px bg-primary-soft shadow-[0_0_16px_color-mix(in_srgb,var(--primary-soft)_75%,transparent)]" />
          <div className="absolute bottom-6 right-5 size-5 rounded-full border border-primary-soft bg-primary-soft/20 shadow-[0_0_18px_color-mix(in_srgb,var(--primary-soft)_65%,transparent)]" />
        </>
      ) : null}
      <p className="absolute bottom-3 left-3 truncate text-caption text-text-muted">
        {label}
      </p>
    </div>
  )
}

function ReportRailScreenshot({
  screenshot,
  isActive,
}: {
  screenshot: ReportScreenshot
  isActive: boolean
}) {
  return (
    <div
      aria-hidden={!isActive}
      className={cn(
        "absolute inset-0 overflow-hidden rounded-lg transition-all duration-slow ease-toolbar",
        isActive
          ? "translate-y-0 opacity-100"
          : "pointer-events-none translate-y-1 opacity-0"
      )}
    >
      <ReportEvidenceFrame {...screenshot} preferThumbnail className="absolute inset-0" />
    </div>
  )
}

function ReportEvidenceViewer({
  activeIndex,
  onActiveIndexChange,
  onOpenChange,
  open,
  report,
}: {
  activeIndex: number
  onActiveIndexChange: (index: number) => void
  onOpenChange: (open: boolean) => void
  open: boolean
  report: WorkspaceReport
}) {
  const total = report.screenshots.length
  const selectedIndex = Math.min(Math.max(activeIndex, 0), total - 1)
  const selectedScreenshot = report.screenshots[selectedIndex] ?? report.screenshots[0]
  const dimensions = selectedScreenshot
    ? getScreenshotDimensions(report, selectedScreenshot)
    : { width: 0, height: 0 }

  function move(direction: -1 | 1) {
    const nextIndex = (selectedIndex + direction + total) % total
    onActiveIndexChange(nextIndex)
  }

  if (!selectedScreenshot) {
    return null
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="!max-w-[min(100vw-2rem,980px)] gap-0 overflow-hidden rounded-xl border border-border-hairline bg-surface-card p-0 text-foreground shadow-popover sm:!max-w-[min(100vw-2rem,980px)]"
      >
        <div className="relative h-[min(78vh,720px)] min-h-[360px] overflow-hidden bg-surface-card">
          {report.screenshots.map((screenshot, index) => (
            <ReportEvidenceFrame
              key={screenshot.id}
              {...screenshot}
              className={cn(
                "absolute inset-0 transition-all duration-slow ease-toolbar",
                index === selectedIndex
                  ? "scale-100 opacity-100"
                  : "pointer-events-none scale-[0.985] opacity-0"
              )}
            />
          ))}

          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-28 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--surface-divider)_86%,transparent),color-mix(in_srgb,var(--surface-divider)_42%,transparent)_52%,transparent)]" />

          <div className="absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 p-4">
            <div className="min-w-0">
              <DialogTitle className="truncate text-heading-5 text-foreground">
                {selectedScreenshot.label} evidence
              </DialogTitle>
              <DialogDescription className="mt-0.5 text-caption text-text-secondary">
                {selectedIndex + 1} of {total} / {dimensions.width} x{" "}
                {dimensions.height} / {report.capturedAt}
              </DialogDescription>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                aria-label="Previous screenshot"
                onClick={() => move(-1)}
                className="flex size-8 cursor-pointer items-center justify-center rounded-lg border border-border-hairline bg-background/70 text-text-secondary shadow-button-secondary backdrop-blur-md transition-all duration-base ease-out-soft hover:bg-fill-subtle hover:text-foreground hover:shadow-button-hover active:scale-[var(--press-scale)]"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                aria-label="Next screenshot"
                onClick={() => move(1)}
                className="flex size-8 cursor-pointer items-center justify-center rounded-lg border border-border-hairline bg-background/70 text-text-secondary shadow-button-secondary backdrop-blur-md transition-all duration-base ease-out-soft hover:bg-fill-subtle hover:text-foreground hover:shadow-button-hover active:scale-[var(--press-scale)]"
              >
                <ChevronRight className="size-4" />
              </button>
              <button
                type="button"
                aria-label="Close screenshot viewer"
                onClick={() => onOpenChange(false)}
                className="flex size-8 cursor-pointer items-center justify-center rounded-lg border border-border-hairline bg-background/70 text-text-secondary shadow-button-secondary backdrop-blur-md transition-all duration-base ease-out-soft hover:bg-fill-subtle hover:text-foreground hover:shadow-button-hover active:scale-[var(--press-scale)]"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ReportEvidenceTabs({
  report,
  workspaceSlug,
}: {
  report: WorkspaceReport
  workspaceSlug: string
}) {
  const [activeView, setActiveView] = useState<"page" | "element">("page")
  const [isViewerOpen, setIsViewerOpen] = useState(false)
  const [viewerIndex, setViewerIndex] = useState(0)
  const activeKind = activeView === "page" ? "page" : "annotated"
  const activeScreenshotIndex = Math.max(
    0,
    report.screenshots.findIndex((screenshot) => screenshot.kind === activeKind)
  )

  return (
    <section className="border-b border-border-hairline px-4 py-3">
      <p className="text-caption text-text-muted">View</p>
      <div className="relative mt-2 grid grid-cols-2 rounded-lg border border-border-hairline bg-background p-1">
        <span
          className={cn(
            "absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-md bg-surface-raised shadow-button-hover transition-transform duration-base ease-out-soft",
            activeView === "element" && "translate-x-[calc(100%+0.25rem)]"
          )}
          aria-hidden="true"
        />
        {(["page", "element"] as const).map((view) => (
          <button
            key={view}
            type="button"
            onClick={() => setActiveView(view)}
            className={cn(
              "relative z-10 h-7 cursor-pointer rounded-md text-heading-5 capitalize transition-colors duration-base ease-out-soft active:scale-[var(--press-scale)]",
              activeView === view
                ? "text-foreground"
                : "text-text-muted hover:text-text-secondary"
            )}
          >
            {view}
          </button>
        ))}
      </div>

      <div className="relative mt-3 aspect-[16/10] overflow-hidden rounded-lg border border-border-hairline bg-fill-translucent">
        {report.screenshots.map((screenshot) => (
          <ReportRailScreenshot
            key={screenshot.id}
            screenshot={screenshot}
            isActive={screenshot.kind === activeKind}
          />
        ))}
        <button
          type="button"
          aria-label="Open screenshot viewer"
          onClick={() => {
            setViewerIndex(activeScreenshotIndex)
            setIsViewerOpen(true)
          }}
          className="absolute bottom-2 right-2 z-10 flex size-7 cursor-pointer items-center justify-center rounded-md border border-border-subtle bg-surface-raised text-foreground shadow-button-hover transition-all duration-base ease-out-soft hover:border-border-strong hover:brightness-110 active:scale-[var(--press-scale)]"
        >
          <Maximize2 className="size-3.5" />
        </button>
      </div>

      <Link
        href={`/${workspaceSlug}/reports/${report.id}`}
        className="mt-3 inline-flex h-8 w-full cursor-pointer items-center justify-center gap-1.5 rounded-md border border-border-subtle bg-surface-raised px-2.5 text-heading-5 text-foreground shadow-button-hover transition-all duration-base ease-out-soft hover:border-border-strong hover:brightness-110 active:scale-[var(--press-scale)]"
      >
        Open report
        <ArrowUpRight className="size-3.5" />
      </Link>
      <ReportEvidenceViewer
        activeIndex={viewerIndex}
        onActiveIndexChange={setViewerIndex}
        onOpenChange={setIsViewerOpen}
        open={isViewerOpen}
        report={report}
      />
    </section>
  )
}

function RightRailSkeletonBlock({
  className,
  rounded = "rounded-md",
}: {
  className?: string
  rounded?: string
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "block animate-pulse bg-fill-translucent",
        "shadow-[inset_0_1px_0_color-mix(in_srgb,var(--foreground)_5%,transparent)]",
        rounded,
        className
      )}
    />
  )
}

function RightRailMetaSkeleton({
  labelWidth,
  valueWidth,
}: {
  labelWidth: string
  valueWidth: string
}) {
  return (
    <div className="rounded-lg border border-border-hairline bg-fill-translucent px-2.5 py-2">
      <RightRailSkeletonBlock className={cn("h-2.5", labelWidth)} />
      <RightRailSkeletonBlock className={cn("mt-2 h-3", valueWidth)} />
    </div>
  )
}

function EmptyReportRail({ className }: { className?: string }) {
  return (
    <div className={cn("feedme-scrollbar-hidden h-full w-right-rail overflow-y-auto", className)}>
      <section className="border-b border-border-hairline px-4 py-4">
        <div className="flex size-9 items-center justify-center rounded-lg border border-border-hairline bg-fill-translucent text-text-body shadow-button-secondary">
          <ClipboardList className="size-4" />
        </div>
        <h2 className="mt-3 text-heading-5 text-foreground">Select a report</h2>
        <p className="mt-1 text-body-3 text-text-body">
          Report metadata, screenshots, selected element, and developer prompt
          will appear here.
        </p>
      </section>
    </div>
  )
}

function ReportInspectorRailSkeleton({ className }: { className?: string }) {
  return (
    <div
      aria-busy="true"
      aria-label="Loading report details"
      className={cn("feedme-scrollbar-hidden h-full w-right-rail overflow-y-auto", className)}
    >
      <section className="border-b border-border-hairline px-4 py-4">
        <div className="flex items-center gap-1.5">
          <RightRailSkeletonBlock className="h-5 w-14" />
          <RightRailSkeletonBlock className="h-5 w-16" />
        </div>
        <RightRailSkeletonBlock className="mt-3 h-3.5 w-3/4" />
        <RightRailSkeletonBlock className="mt-2 h-2.5 w-1/2" />
      </section>

      <section className="border-b border-border-hairline px-4 py-3">
        <div className="grid grid-cols-2 gap-1 rounded-lg border border-border-hairline bg-background p-1">
          <RightRailSkeletonBlock className="h-7" />
          <span aria-hidden="true" className="h-7" />
        </div>
        <div
          aria-hidden="true"
          className="mt-3 aspect-[16/10] animate-pulse rounded-lg border border-border-hairline bg-fill-translucent"
        />
        <RightRailSkeletonBlock className="mt-3 h-8 w-full" />
      </section>

      <section className="grid grid-cols-2 gap-2 border-b border-border-hairline px-4 py-3">
        <RightRailMetaSkeleton labelWidth="w-8" valueWidth="w-12" />
        <RightRailMetaSkeleton labelWidth="w-12" valueWidth="w-6" />
        <RightRailMetaSkeleton labelWidth="w-9" valueWidth="w-14" />
        <RightRailMetaSkeleton labelWidth="w-10" valueWidth="w-12" />
      </section>

      <section className="space-y-2 border-b border-border-hairline px-4 py-3">
        <RightRailSkeletonBlock className="h-2.5 w-24" />
        <RightRailSkeletonBlock className="h-2.5 w-full" />
        <RightRailSkeletonBlock className="h-2.5 w-4/5" />
      </section>

      <section className="space-y-2 px-4 py-3">
        <RightRailSkeletonBlock className="h-2.5 w-28" />
        <RightRailSkeletonBlock className="h-2.5 w-full" />
        <RightRailSkeletonBlock className="h-2.5 w-11/12" />
      </section>
    </div>
  )
}

function getReportMutationBaseUrl(workspaceSlug: string, reportId: string) {
  return `/api/workspaces/${encodeURIComponent(workspaceSlug)}/reports/${encodeURIComponent(reportId)}`
}

function getMutationErrorMessage(error: unknown) {
  if (error instanceof ApiClientError) {
    return error.message
  }

  return "Something went wrong. Please try again."
}

function canManageReportAssignments(workspace: MockWorkspace) {
  return workspace.currentUserRole === "owner" || workspace.currentUserRole === "admin"
}

function isAssignedDeveloperReport(workspace: MockWorkspace, report: WorkspaceReport) {
  return (
    workspace.currentUserRole === "developer" &&
    Boolean(workspace.currentUserId) &&
    report.assigneeUserId === workspace.currentUserId
  )
}

const reportRailActionButtonClass =
  "inline-flex h-8 w-full cursor-pointer items-center justify-center gap-1.5 rounded-md border border-border-subtle bg-surface-raised px-2.5 text-heading-5 text-foreground shadow-button-hover transition-all duration-base ease-out-soft hover:border-border-strong hover:brightness-110 active:scale-[var(--press-scale)] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:border-border-subtle disabled:hover:brightness-100 disabled:active:scale-100"

const optimisticUnassignResetStatuses: WorkspaceReport["status"][] = [
  "assigned",
  "in_progress",
  "ready_for_review",
]

function ReportRailAssignmentPanel({
  members,
  membersErrorMessage,
  membersIsLoading,
  onReportChange,
  report,
  workspace,
}: {
  members: WorkspaceTeamMember[]
  membersErrorMessage: string | null
  membersIsLoading: boolean
  onReportChange: (report: WorkspaceReport) => void
  report: WorkspaceReport
  workspace: MockWorkspace
}) {
  const [selectedAssigneeUserId, setSelectedAssigneeUserId] = useState(
    report.assigneeUserId ?? unassignedSelectValue
  )
  const [assigneeMenuOpen, setAssigneeMenuOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const developerMembers = members.filter(
    (member) => member.role === "developer" && member.status === "active"
  )
  const selectedDeveloper = developerMembers.find(
    (member) => member.userId === selectedAssigneeUserId
  )
  const selectedAssigneeLabel =
    selectedAssigneeUserId === unassignedSelectValue
      ? "Unassigned"
      : selectedDeveloper?.name ?? report.assignee?.name ?? "Unknown developer"
  const isAssignmentControlDisabled =
    isSaving || membersIsLoading || Boolean(membersErrorMessage)
  const hasAssignmentChange =
    selectedAssigneeUserId !== (report.assigneeUserId ?? unassignedSelectValue)

  async function saveAssignment() {
    setIsSaving(true)
    setError(null)
    setMessage(null)

    const nextAssigneeUserId =
      selectedAssigneeUserId === unassignedSelectValue
        ? null
        : selectedAssigneeUserId
    const optimisticAssignee = nextAssigneeUserId
      ? developerMembers.find((member) => member.userId === nextAssigneeUserId)
      : undefined
    const optimisticReport: WorkspaceReport = {
      ...report,
      assignee: optimisticAssignee
        ? {
            avatarUrl: optimisticAssignee.avatarUrl,
            initials: optimisticAssignee.initials,
            name: optimisticAssignee.name,
          }
        : undefined,
      assigneeUserId: nextAssigneeUserId,
      status: nextAssigneeUserId
        ? "assigned"
        : optimisticUnassignResetStatuses.includes(report.status)
          ? "reviewing"
          : report.status,
    }

    onReportChange(optimisticReport)

    try {
      const result = await patchJson<ReportMutationResponse>(
        `${getReportMutationBaseUrl(workspace.slug, report.id)}/assignment`,
        {
          assigneeUserId: nextAssigneeUserId,
        }
      )

      onReportChange(result.report)
      setMessage("Assignment saved.")
    } catch (saveError) {
      onReportChange(report)
      setError(getMutationErrorMessage(saveError))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="border-b border-border-hairline px-4 py-3">
      <div className="flex items-center gap-2 text-heading-5 text-foreground">
        <UserRoundCheck className="size-4 text-text-muted" />
        Assignment
      </div>
      <p className="mt-1 text-caption text-text-muted">
        Route this report to an active developer.
      </p>

      <div className="mt-3 space-y-2">
        <div
          className="relative"
          onBlur={(event) => {
            const nextTarget = event.relatedTarget

            if (
              !(nextTarget instanceof Node) ||
              !event.currentTarget.contains(nextTarget)
            ) {
              setAssigneeMenuOpen(false)
            }
          }}
        >
          <button
            type="button"
            aria-haspopup="listbox"
            aria-expanded={assigneeMenuOpen}
            disabled={isAssignmentControlDisabled}
            onClick={() => setAssigneeMenuOpen((value) => !value)}
            className={cn(
              "flex h-8 w-full cursor-pointer items-center justify-between gap-2 rounded-md border border-border-hairline bg-fill-translucent px-2.5 text-left text-body-3 text-text-secondary shadow-button-secondary outline-none transition-all duration-base ease-out-soft",
              "hover:bg-fill-subtle hover:text-foreground hover:shadow-button-hover focus:border-border-strong active:scale-[var(--press-scale)]",
              isAssignmentControlDisabled &&
                "cursor-not-allowed opacity-50 hover:bg-fill-translucent hover:text-text-secondary hover:shadow-button-secondary active:scale-100"
            )}
          >
            <span className="min-w-0 truncate">
              {membersIsLoading ? "Loading developers..." : selectedAssigneeLabel}
            </span>
            <ChevronDown
              className={cn(
                "size-3.5 shrink-0 transition-transform duration-base ease-out-soft",
                assigneeMenuOpen && "rotate-180 text-text-secondary"
              )}
            />
          </button>

          {assigneeMenuOpen ? (
            <div
              role="listbox"
              aria-label="Assign report"
              className="absolute left-0 right-0 top-[calc(100%+0.375rem)] z-30 overflow-hidden rounded-lg border border-border-subtle bg-surface-card p-1 text-foreground shadow-popover"
            >
              {[
                {
                  email: null,
                  label: "Unassigned",
                  value: unassignedSelectValue,
                },
                ...developerMembers.map((member) => ({
                  email: member.email,
                  label: member.name,
                  value: member.userId,
                })),
              ].map((option) => {
                const selected = selectedAssigneeUserId === option.value

                return (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => {
                      setSelectedAssigneeUserId(option.value)
                      setAssigneeMenuOpen(false)
                      setMessage(null)
                      setError(null)
                    }}
                    className={cn(
                      "flex min-h-8 w-full cursor-pointer items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-body-3 transition-colors duration-base ease-out-soft",
                      selected
                        ? "bg-surface-raised text-foreground shadow-button-hover"
                        : "text-text-body hover:bg-fill-subtle hover:text-foreground"
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block truncate">{option.label}</span>
                      {option.email ? (
                        <span className="block truncate text-caption text-text-muted">
                          {option.email}
                        </span>
                      ) : null}
                    </span>
                    {selected ? (
                      <Check className="size-3.5 shrink-0 text-text-secondary" />
                    ) : null}
                  </button>
                )
              })}
            </div>
          ) : null}
        </div>

        <button
          type="button"
          disabled={
            isSaving ||
            membersIsLoading ||
            Boolean(membersErrorMessage) ||
            !hasAssignmentChange
          }
          onClick={saveAssignment}
          className={reportRailActionButtonClass}
        >
          {isSaving ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Send className="size-3.5" />
          )}
          Save assignment
        </button>
      </div>

      {membersErrorMessage ? (
        <p className="mt-2 text-caption text-error">{membersErrorMessage}</p>
      ) : null}
      {!membersIsLoading && !membersErrorMessage && developerMembers.length === 0 ? (
        <p className="mt-2 text-caption text-text-muted">
          Invite an active developer before assigning reports.
        </p>
      ) : null}
      {message ? <p className="mt-2 text-caption text-success">{message}</p> : null}
      {error ? <p className="mt-2 text-caption text-error">{error}</p> : null}
    </section>
  )
}

function ReportRailDeveloperStatusPanel({
  onReportChange,
  report,
  workspace,
}: {
  onReportChange: (report: WorkspaceReport) => void
  report: WorkspaceReport
  workspace: MockWorkspace
}) {
  const [isSavingStatus, setIsSavingStatus] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const canStartWork = report.status === "assigned"
  const canMarkReady =
    report.status === "assigned" || report.status === "in_progress"

  if (!isAssignedDeveloperReport(workspace, report)) {
    return null
  }

  async function updateStatus(
    status: WorkspaceReport["status"],
    successMessage: string
  ) {
    setIsSavingStatus(true)
    setMessage(null)
    setError(null)

    const optimisticReport: WorkspaceReport = {
      ...report,
      status,
    }

    onReportChange(optimisticReport)

    try {
      const result = await patchJson<ReportMutationResponse>(
        `${getReportMutationBaseUrl(workspace.slug, report.id)}/status`,
        { status }
      )

      onReportChange(result.report)
      setMessage(successMessage)
    } catch (statusError) {
      onReportChange(report)
      setError(getMutationErrorMessage(statusError))
    } finally {
      setIsSavingStatus(false)
    }
  }

  return (
    <section className="border-b border-border-hairline px-4 py-3">
      <div className="flex items-center gap-2 text-heading-5 text-foreground">
        <ListFilter className="size-4 text-text-muted" />
        Work status
      </div>
      <p className="mt-1 text-caption text-text-muted">
        Move your assigned report through implementation.
      </p>

      <div className="mt-3 grid gap-2">
        <button
          type="button"
          disabled={!canStartWork || isSavingStatus}
          onClick={() => updateStatus("in_progress", "Work marked in progress.")}
          className={reportRailActionButtonClass}
        >
          {isSavingStatus && canStartWork ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Play className="size-3.5" />
          )}
          Start work
        </button>
        <button
          type="button"
          disabled={!canMarkReady || isSavingStatus}
          onClick={() =>
            updateStatus("ready_for_review", "Report marked ready for review.")
          }
          className={reportRailActionButtonClass}
        >
          {isSavingStatus && canMarkReady ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <CheckCircle2 className="size-3.5" />
          )}
          Ready for review
        </button>
      </div>

      {message ? <p className="mt-2 text-caption text-success">{message}</p> : null}
      {error ? <p className="mt-2 text-caption text-error">{error}</p> : null}
    </section>
  )
}

function ReportInspectorRail({
  className,
  members,
  membersErrorMessage,
  membersIsLoading,
  onReportChange,
  report,
  workspace,
}: {
  className?: string
  members: WorkspaceTeamMember[]
  membersErrorMessage: string | null
  membersIsLoading: boolean
  onReportChange: (report: WorkspaceReport) => void
  report: WorkspaceReport
  workspace: MockWorkspace
}) {
  return (
    <div className={cn("feedme-scrollbar-hidden h-full w-right-rail overflow-y-auto", className)}>
      <section className="border-b border-border-hairline px-4 py-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <ReportRailBadge className={reportSeverityPillStyles[report.severity]}>
            {report.severity}
          </ReportRailBadge>
          <ReportRailBadge className={reportStatusPillStyles[report.status]}>
            {getReportStatusLabel(report.status)}
          </ReportRailBadge>
        </div>
        <h2 className="mt-3 line-clamp-2 text-heading-5 text-foreground">
          {report.title}
        </h2>
        <p className="mt-2 line-clamp-3 text-body-3 text-text-body">
          {report.summary}
        </p>
      </section>

      <ReportEvidenceTabs report={report} workspaceSlug={workspace.slug} />

      {canManageReportAssignments(workspace) ? (
        <ReportRailAssignmentPanel
          key={`${report.id}:${report.assigneeUserId ?? "unassigned"}`}
          members={members}
          membersErrorMessage={membersErrorMessage}
          membersIsLoading={membersIsLoading}
          onReportChange={onReportChange}
          report={report}
          workspace={workspace}
        />
      ) : null}

      <ReportRailDeveloperStatusPanel
        key={`${report.id}:${report.status}`}
        onReportChange={onReportChange}
        report={report}
        workspace={workspace}
      />

      <section className="grid grid-cols-2 gap-2 border-b border-border-hairline px-4 py-3">
        <ReportRailMeta label="Type" value={report.type} />
        <ReportRailMeta label="Comments" value={report.commentsCount} />
        <ReportRailMeta
          label="Owner"
          value={
            report.assignee ? (
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <FeedMeAvatar
                  className="shadow-none"
                  displayValue={report.assignee.initials}
                  imageUrl={report.assignee.avatarUrl}
                  label={report.assignee.name}
                  size={18}
                  value={report.assignee.name}
                />
                <span className="truncate">{report.assignee.name}</span>
              </span>
            ) : (
              "Unassigned"
            )
          }
        />
        <ReportRailMeta label="Captured" value={report.capturedAgo} />
      </section>

      <section className="border-b border-border-hairline px-4 py-3">
        <div className="flex items-center gap-2 text-heading-5 text-foreground">
          <MousePointer2 className="size-4 text-text-muted" />
          Selected element
        </div>
        <div className="mt-2 rounded-lg border border-border-hairline bg-background p-2.5">
          <p className="line-clamp-2 font-mono text-caption text-text-secondary">
            {report.selectedElement.selector}
          </p>
          {report.selectedElement.text ? (
            <p className="mt-1 line-clamp-1 text-caption text-text-muted">
              {report.selectedElement.text}
            </p>
          ) : null}
        </div>
      </section>

      <section className="px-4 py-3">
        <div className="flex items-center gap-2 text-heading-5 text-foreground">
          <Code2 className="size-4 text-text-muted" />
          Developer prompt
        </div>
        <div className="feedme-scrollbar mt-2 max-h-32 overflow-y-auto whitespace-pre-wrap rounded-lg border border-border-hairline bg-background p-2.5 text-caption text-text-body">
          {report.developerPrompt}
        </div>
      </section>
    </div>
  )
}

function ReportsContextRail({
  className,
  isLoading,
  members,
  membersErrorMessage,
  membersIsLoading,
  onReportChange,
  reports,
  selectedReportId,
  workspace,
}: {
  className?: string
  isLoading: boolean
  members: WorkspaceTeamMember[]
  membersErrorMessage: string | null
  membersIsLoading: boolean
  onReportChange: (report: WorkspaceReport) => void
  reports: WorkspaceReport[]
  selectedReportId: string | null
  workspace: MockWorkspace
}) {
  const [detailReportsById, setDetailReportsById] = useState<
    Record<string, WorkspaceReport>
  >({})

  const selectedSummaryReport =
    reports.find((report) => report.id === selectedReportId) ?? reports[0]
  const selectedDetailReport = selectedSummaryReport
    ? detailReportsById[selectedSummaryReport.id]
    : undefined
  const selectedReport = selectedDetailReport ?? selectedSummaryReport
  const handleReportChange = useCallback(
    (nextReport: WorkspaceReport) => {
      setDetailReportsById((currentDetails) => ({
        ...currentDetails,
        [nextReport.id]: nextReport,
      }))
      onReportChange(nextReport)
    },
    [onReportChange]
  )

  useEffect(() => {
    if (
      isLoading ||
      !selectedSummaryReport ||
      detailReportsById[selectedSummaryReport.id]
    ) {
      return
    }

    let isMounted = true

    async function loadSelectedReportDetail() {
      try {
        const result = await getJson<ReportMutationResponse>(
          getReportMutationBaseUrl(workspace.slug, selectedSummaryReport.id)
        )

        if (isMounted) {
          handleReportChange(result.report)
        }
      } catch {
        // Keep the fast summary rail visible if full evidence is temporarily unavailable.
      }
    }

    void loadSelectedReportDetail()

    return () => {
      isMounted = false
    }
  }, [
    detailReportsById,
    handleReportChange,
    isLoading,
    selectedSummaryReport,
    workspace.slug,
  ])

  if (isLoading) {
    return <ReportInspectorRailSkeleton className={className} />
  }

  if (!selectedReport) {
    return <EmptyReportRail className={className} />
  }

  return (
    <ReportInspectorRail
      className={className}
      members={members}
      membersErrorMessage={membersErrorMessage}
      membersIsLoading={membersIsLoading}
      onReportChange={handleReportChange}
      report={selectedReport}
      workspace={workspace}
    />
  )
}

function TeamMemberRolePill({ role }: { role: WorkspaceTeamMember["role"] }) {
  return (
    <span className="inline-flex h-5 items-center rounded-md border border-border-hairline bg-fill-translucent px-1.5 text-caption font-medium text-text-secondary">
      {getWorkspaceMemberRoleLabel(role)}
    </span>
  )
}

function TeamMemberRailSkeleton({ className }: { className?: string }) {
  return (
    <div
      aria-busy="true"
      aria-label="Loading teammate details"
      className={cn("feedme-scrollbar-hidden h-full w-right-rail overflow-y-auto", className)}
    >
      <section className="border-b border-border-hairline px-5 py-6 text-center">
        <RightRailSkeletonBlock
          className="mx-auto size-14 border border-border-hairline shadow-button-secondary"
          rounded="rounded-full"
        />
        <RightRailSkeletonBlock className="mx-auto mt-3 h-4 w-32" />
        <RightRailSkeletonBlock className="mx-auto mt-2 h-3 w-40" />
        <div className="mt-3 flex flex-wrap justify-center gap-1.5">
          <RightRailSkeletonBlock className="h-5 w-16" />
          <RightRailSkeletonBlock className="h-5 w-14" />
        </div>
      </section>

      <section className="grid grid-cols-2 gap-2 border-b border-border-hairline px-4 py-3">
        <RightRailMetaSkeleton labelWidth="w-12" valueWidth="w-5" />
        <RightRailMetaSkeleton labelWidth="w-11" valueWidth="w-5" />
        <RightRailMetaSkeleton labelWidth="w-8" valueWidth="w-16" />
        <RightRailMetaSkeleton labelWidth="w-10" valueWidth="w-14" />
      </section>

      <section className="px-4 py-3">
        <div className="flex items-center gap-2">
          <RightRailSkeletonBlock className="size-4" rounded="rounded" />
          <RightRailSkeletonBlock className="h-3.5 w-28" />
        </div>
        <div className="mt-2 rounded-lg border border-border-hairline bg-background p-2.5">
          <RightRailSkeletonBlock className="h-2.5 w-full" />
          <RightRailSkeletonBlock className="mt-2 h-2.5 w-5/6" />
          <RightRailSkeletonBlock className="mt-2 h-2.5 w-2/3" />
        </div>
      </section>
    </div>
  )
}

function TeamMemberRail({
  className,
  member,
}: {
  className?: string
  member: WorkspaceTeamMember
}) {
  return (
    <div className={cn("feedme-scrollbar-hidden h-full w-right-rail overflow-y-auto", className)}>
      <section className="border-b border-border-hairline px-5 py-6 text-center">
        <FeedMeAvatar
          className="mx-auto border-border-subtle"
          displayValue={member.initials}
          imageUrl={member.avatarUrl}
          label={member.name}
          size={56}
          value={member.email}
        />
        <h2 className="mt-3 truncate text-heading-3 text-foreground">
          {member.name}
        </h2>
        <p className="mt-1 truncate text-body-3 text-text-muted">
          {member.email}
        </p>
        <div className="mt-3 flex flex-wrap justify-center gap-1.5">
          <TeamMemberRolePill role={member.role} />
          <span className="inline-flex h-5 items-center rounded-md border border-border-hairline bg-fill-translucent px-1.5 text-caption font-medium capitalize text-text-secondary">
            {member.status}
          </span>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-2 border-b border-border-hairline px-4 py-3">
        <ReportRailMeta label="Assigned" value={member.assignedCount} />
        <ReportRailMeta label="Reports" value={member.reportsCount} />
        <ReportRailMeta
          label="Role"
          value={getWorkspaceMemberRoleLabel(member.role)}
        />
        <ReportRailMeta label="Joined" value={member.joinedAtLabel} />
      </section>

      <section className="px-4 py-3">
        <div className="flex items-center gap-2 text-heading-5 text-foreground">
          <ListFilter className="size-4 text-text-muted" />
          Member context
        </div>
        <p className="mt-2 rounded-lg border border-border-hairline bg-background p-2.5 text-caption text-text-body">
          Role controls, recent activity, assigned reports, and submitted
          feedback will live here once team permissions are connected.
        </p>
      </section>
    </div>
  )
}

function TeamContextRail({
  className,
}: {
  className?: string
}) {
  const searchParams = useSearchParams()
  const {
    dashboardSearchQuery,
    membersReady,
    selectedMemberId,
    teamMembers,
    teamVisibleMemberIds,
  } = useWorkspaceDashboardData()

  if (!membersReady) {
    return <TeamMemberRailSkeleton className={className} />
  }

  const roleFilter = searchParams.get("role")
  const membersById = new Map(teamMembers.map((member) => [member.id, member]))
  const visibleMembers = teamVisibleMemberIds
    .map((memberId) => membersById.get(memberId))
    .filter((member): member is WorkspaceTeamMember => Boolean(member))
  const selectedMember =
    visibleMembers.find((member) => member.id === selectedMemberId) ??
    visibleMembers[0]

  if (!selectedMember) {
    return (
      <div className={cn("feedme-scrollbar-hidden h-full w-right-rail overflow-y-auto", className)}>
        <section className="border-b border-border-hairline px-4 py-4">
          <div className="flex size-9 items-center justify-center rounded-lg border border-border-hairline bg-fill-translucent text-text-body shadow-button-secondary">
            <UsersRound className="size-4" />
          </div>
          <h2 className="mt-3 text-heading-5 text-foreground">Select a teammate</h2>
          <p className="mt-1 text-body-3 text-text-body">
            {dashboardSearchQuery || roleFilter
              ? "No teammate matches the current search and role filters."
              : "Member role, workload, and recent activity will appear here."}
          </p>
        </section>
      </div>
    )
  }

  return <TeamMemberRail className={className} member={selectedMember} />
}

function MobileRightRailSheet({
  onReportChange,
  reportRailIsLoading,
  reportRailMembers,
  reportRailMembersErrorMessage,
  reportRailMembersIsLoading,
  reportRailReports,
  reportRailSelectedReportId,
  workspace,
}: {
  onReportChange?: (report: WorkspaceReport) => void
  reportRailIsLoading?: boolean
  reportRailMembers?: WorkspaceTeamMember[]
  reportRailMembersErrorMessage?: string | null
  reportRailMembersIsLoading?: boolean
  reportRailReports?: WorkspaceReport[]
  reportRailSelectedReportId?: string | null
  workspace: MockWorkspace
}) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <IconButton label="Open details panel">
          <PanelRightOpen className="size-4" />
        </IconButton>
      </SheetTrigger>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="!w-screen !max-w-none overflow-hidden border-border-hairline bg-background p-0 text-foreground shadow-popover"
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border-hairline px-4">
          <SheetTitle className="text-heading-5">Workspace details</SheetTitle>
          <SheetClose asChild>
            <button
              type="button"
              aria-label="Close details panel"
              className="flex size-8 cursor-pointer items-center justify-center rounded-lg border border-border-hairline bg-fill-translucent text-text-body shadow-button-secondary transition-all duration-base ease-out-soft hover:bg-fill-subtle hover:text-foreground hover:shadow-button-hover active:scale-[var(--press-scale)]"
            >
              <X className="size-4" />
            </button>
          </SheetClose>
        </div>
        <WorkspaceRightRailContent
          className="w-full"
          onReportChange={onReportChange}
          reportRailIsLoading={reportRailIsLoading}
          reportRailMembers={reportRailMembers}
          reportRailMembersErrorMessage={reportRailMembersErrorMessage}
          reportRailMembersIsLoading={reportRailMembersIsLoading}
          reportRailReports={reportRailReports}
          reportRailSelectedReportId={reportRailSelectedReportId}
          workspace={workspace}
        />
      </SheetContent>
    </Sheet>
  )
}

function WorkspaceRightRail({
  isOpen,
  onReportChange,
  reportRailIsLoading,
  reportRailMembers,
  reportRailMembersErrorMessage,
  reportRailMembersIsLoading,
  reportRailReports,
  reportRailSelectedReportId,
  workspace,
}: {
  isOpen: boolean
  onReportChange?: (report: WorkspaceReport) => void
  reportRailIsLoading?: boolean
  reportRailMembers?: WorkspaceTeamMember[]
  reportRailMembersErrorMessage?: string | null
  reportRailMembersIsLoading?: boolean
  reportRailReports?: WorkspaceReport[]
  reportRailSelectedReportId?: string | null
  workspace: MockWorkspace
}) {
  return (
    <aside
      aria-hidden={!isOpen}
      className={cn(
        "hidden h-full min-w-0 overflow-hidden border-l transition-[opacity,transform,border-color,filter] duration-[720ms] ease-toolbar will-change-transform lg:block",
        isOpen
          ? "translate-x-0 border-border-hairline opacity-100 blur-0"
          : "translate-x-4 border-l-transparent opacity-0 blur-[1px]"
      )}
    >
      <WorkspaceRightRailContent
        onReportChange={onReportChange}
        reportRailIsLoading={reportRailIsLoading}
        reportRailMembers={reportRailMembers}
        reportRailMembersErrorMessage={reportRailMembersErrorMessage}
        reportRailMembersIsLoading={reportRailMembersIsLoading}
        reportRailReports={reportRailReports}
        reportRailSelectedReportId={reportRailSelectedReportId}
        workspace={workspace}
      />
    </aside>
  )
}

export function WorkspaceShell({
  availableWorkspaces,
  children,
  workspace,
}: WorkspaceShellProps) {
  const searchParams = useSearchParams()

  return (
    <WorkspaceDashboardDataProvider
      initialDashboardSearchQuery={searchParams.get("q")?.trim() ?? ""}
    >
      <WorkspaceShellContent
        availableWorkspaces={availableWorkspaces}
        workspace={workspace}
      >
        {children}
      </WorkspaceShellContent>
    </WorkspaceDashboardDataProvider>
  )
}

function WorkspaceShellContent({
  availableWorkspaces,
  children,
  workspace,
}: WorkspaceShellProps) {
  const [isRightRailOpen, setIsRightRailOpen] = useState(true)
  const [isExtensionInstallOpen, setIsExtensionInstallOpen] = useState(false)
  const [reportRailMembers, setReportRailMembers] = useState<WorkspaceTeamMember[]>([])
  const [reportRailMembersIsLoading, setReportRailMembersIsLoading] = useState(
    () => canManageReportAssignments(workspace)
  )
  const [reportRailMembersErrorMessage, setReportRailMembersErrorMessage] =
    useState<string | null>(null)
  const {
    reportRailReady,
    reportRailReports,
    reportRailSelectedReportId,
    reportRailVisibleIds,
    updateReport,
  } = useWorkspaceDashboardData()
  const pathname = usePathname()
  const reportsPath = `/${workspace.slug}/reports`
  const myWorkPath = `/${workspace.slug}/my-work`
  const isReportsIndexRoute = pathname === reportsPath
  const isMyWorkRoute = pathname === myWorkPath
  const isReportRailRoute = isReportsIndexRoute || isMyWorkRoute
  const isReportDetailRoute = pathname.startsWith(`${reportsPath}/`)
  const reportRailMembersEndpoint = `/api/workspaces/${encodeURIComponent(workspace.slug)}/members`
  const canManageAssignments = canManageReportAssignments(workspace)
  const reportRailReportsById = new Map(
    reportRailReports.map((report) => [report.id, report])
  )
  const scopedReportRailReports = isReportRailRoute
    ? reportRailVisibleIds
        .map((reportId) => reportRailReportsById.get(reportId))
        .filter((report): report is WorkspaceReport => Boolean(report))
    : []
  const reportRailIsLoading = isReportRailRoute && !reportRailReady

  useEffect(() => {
    let isMounted = true

    async function loadMembers() {
      setReportRailMembersIsLoading(true)
      setReportRailMembersErrorMessage(null)

      try {
        const result = await getJson<WorkspaceMembersResponse>(reportRailMembersEndpoint)

        if (isMounted) {
          setReportRailMembers(result.members)
        }
      } catch (error) {
        if (isMounted) {
          setReportRailMembersErrorMessage(
            error instanceof ApiClientError
              ? error.message
              : "Unable to load team members. Please try again."
          )
        }
      } finally {
        if (isMounted) {
          setReportRailMembersIsLoading(false)
        }
      }
    }

    if (isReportRailRoute && canManageAssignments) {
      void loadMembers()
    }

    return () => {
      isMounted = false
    }
  }, [canManageAssignments, isReportRailRoute, reportRailMembersEndpoint])

  const handleReportChange = useCallback((nextReport: WorkspaceReport) => {
    updateReport(nextReport)
  }, [updateReport])

  // reportCount comes from the server render, so an empty workspace is known on
  // the very first paint. This suppresses the rail synchronously instead of
  // flashing the loading skeleton before the client store reports "empty".
  const workspaceHasNoReports = (workspace.reportCount ?? 0) === 0
  const shouldDisableReportsRail =
    isReportsIndexRoute &&
    (workspaceHasNoReports ||
      (!reportRailIsLoading && scopedReportRailReports.length === 0))
  const shouldDisableMyWorkRail =
    isMyWorkRoute &&
    !reportRailIsLoading &&
    scopedReportRailReports.length === 0
  const isRightRailEnabled =
    !isReportDetailRoute && !shouldDisableReportsRail && !shouldDisableMyWorkRail
  const shouldShowRightRail = isRightRailEnabled && isRightRailOpen

  return (
    <>
      <ExtensionInstallDialog
        open={isExtensionInstallOpen}
        onOpenChange={setIsExtensionInstallOpen}
      />
      <main className="flex h-screen overflow-hidden bg-card text-foreground">
      <WorkspaceSidebar
        availableWorkspaces={availableWorkspaces}
        onOpenExtensionInstall={() => setIsExtensionInstallOpen(true)}
        workspace={workspace}
      />

      <section className="min-w-0 flex-1 p-2 lg:pl-0">
        <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border-hairline bg-background shadow-card">
          <WorkspaceTopbar
            availableWorkspaces={availableWorkspaces}
            isRightRailOpen={isRightRailOpen}
            isRightRailEnabled={isRightRailEnabled}
            onOpenExtensionInstall={() => setIsExtensionInstallOpen(true)}
            onReportChange={handleReportChange}
            onToggleRightRail={() => setIsRightRailOpen((value) => !value)}
            reportRailIsLoading={isReportRailRoute && reportRailIsLoading}
            reportRailMembers={reportRailMembers}
            reportRailMembersErrorMessage={reportRailMembersErrorMessage}
            reportRailMembersIsLoading={reportRailMembersIsLoading}
            reportRailReports={reportRailReports}
            reportRailSelectedReportId={reportRailSelectedReportId}
            workspace={workspace}
          />
          <div
            className={cn(
              "grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] transition-[grid-template-columns] duration-[720ms] ease-toolbar will-change-[grid-template-columns]",
              !isRightRailEnabled
                ? "lg:grid-cols-[minmax(0,1fr)]"
                : shouldShowRightRail
                  ? "lg:grid-cols-[minmax(0,1fr)_var(--right-rail-width)]"
                  : "lg:grid-cols-[minmax(0,1fr)_0px]"
            )}
          >
            <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
            {isRightRailEnabled ? (
              <WorkspaceRightRail
                isOpen={isRightRailOpen}
                onReportChange={handleReportChange}
                reportRailIsLoading={isReportRailRoute && reportRailIsLoading}
                reportRailMembers={reportRailMembers}
                reportRailMembersErrorMessage={reportRailMembersErrorMessage}
                reportRailMembersIsLoading={reportRailMembersIsLoading}
                reportRailReports={scopedReportRailReports}
                reportRailSelectedReportId={reportRailSelectedReportId}
                workspace={workspace}
              />
            ) : null}
          </div>
        </div>
      </section>
      </main>
    </>
  )
}
