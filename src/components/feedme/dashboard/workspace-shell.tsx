"use client"

import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  ArrowUpRight,
  Camera,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  Code2,
  Globe2,
  Grid2X2,
  Inbox,
  ListFilter,
  Maximize2,
  Menu,
  MessageSquare,
  MousePointer2,
  PanelRightClose,
  PanelRightOpen,
  Search,
  Table2,
  UserRound,
  UsersRound,
  X,
} from "lucide-react"
import { useState, useSyncExternalStore, type ComponentType, type ReactNode } from "react"

import {
  getMockReports,
  type MockReportSummary,
  type MockWorkspace,
} from "@/lib/mock/dashboard"
import {
  reportBadgeBaseClass,
  reportSeverityPillStyles,
  reportStatusPillStyles,
} from "@/components/feedme/dashboard/report-badge-styles"
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

type WorkspaceShellProps = {
  children: ReactNode
  workspace: MockWorkspace
}

type NavItem = {
  href: string
  icon: ComponentType<{ className?: string }>
  label: string
  planned?: boolean
}

type ReportScreenshot = MockReportSummary["screenshots"][number]

const navItems: NavItem[] = [
  { href: "inbox", icon: Inbox, label: "Inbox", planned: true },
  { href: "reports", icon: ClipboardList, label: "Reports" },
  { href: "my-work", icon: UserRound, label: "My Work", planned: true },
  { href: "team", icon: UsersRound, label: "Team", planned: true },
  { href: "domains", icon: Globe2, label: "Domains", planned: true },
]

const extensionCardDismissedKey = "feedme:extension-card-dismissed"
const extensionCardDismissedEvent = "feedme:extension-card-dismissed-change"

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
}: {
  children: ReactNode
  className?: string
  ariaLabel?: string
}) {
  return (
    <Button
      aria-label={ariaLabel}
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

function WorkspaceSwitcher({ workspace }: { workspace: MockWorkspace }) {
  return (
    <button
      type="button"
      className="flex h-10 w-full cursor-pointer items-center gap-2 rounded-lg px-2 text-left text-foreground transition-colors hover:bg-fill-translucent"
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
      <ChevronDown className="size-4 text-muted-foreground" />
    </button>
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

function ExtensionCard() {
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
        className="mt-3 flex h-8 w-full cursor-pointer items-center justify-center rounded-md border border-border-subtle bg-surface-raised text-heading-5 text-foreground shadow-button-hover transition-all duration-base ease-out-soft hover:border-border-strong hover:brightness-110 active:scale-[var(--press-scale)]"
      >
        Install extension
      </button>
    </section>
  )
}

function WorkspaceSidebar({ workspace }: { workspace: MockWorkspace }) {
  return (
    <aside className="hidden h-screen w-sidebar shrink-0 flex-col bg-card p-2.5 lg:flex">
      <WorkspaceSwitcher workspace={workspace} />
      <SidebarNav workspaceSlug={workspace.slug} />

      <div className="mt-auto space-y-2">
        <ExtensionCard />
      </div>
    </aside>
  )
}

function MobileNavSheet({ workspace }: { workspace: MockWorkspace }) {
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
            <WorkspaceSwitcher workspace={workspace} />
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
          <ExtensionCard />
        </div>
      </SheetContent>
    </Sheet>
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
          <div className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-lg border border-border-subtle bg-background px-3">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input
              aria-label="Search reports, domains, people"
              autoFocus
              className="h-full min-w-0 flex-1 border-0 bg-transparent text-body-2 text-foreground outline-none placeholder:text-muted-foreground"
              placeholder={`Search ${workspace.name}...`}
            />
          </div>
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
  const router = useRouter()
  const searchParams = useSearchParams()
  const reportsPath = `/${workspaceSlug}/reports`
  const isReportsIndex = pathname === reportsPath
  const isTableView = searchParams.get("view") === "table"

  if (!isReportsIndex) {
    return (
      <IconButton label="Help">
        <CircleHelp className="size-4" />
      </IconButton>
    )
  }

  function toggleView() {
    const nextSearchParams = new URLSearchParams(searchParams.toString())

    if (isTableView) {
      nextSearchParams.delete("view")
    } else {
      nextSearchParams.set("view", "table")
    }

    const query = nextSearchParams.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }

  return (
    <IconButton
      label={isTableView ? "Switch to grid view" : "Switch to table view"}
      onClick={toggleView}
      pressed={isTableView}
    >
      {isTableView ? (
        <Grid2X2 className="size-4" />
      ) : (
        <Table2 className="size-4" />
      )}
    </IconButton>
  )
}

function WorkspaceTopbar({
  isRightRailOpen,
  isRightRailEnabled,
  onToggleRightRail,
  workspace,
}: {
  isRightRailOpen: boolean
  isRightRailEnabled: boolean
  onToggleRightRail: () => void
  workspace: MockWorkspace
}) {
  return (
    <>
      <header className="hidden h-topbar shrink-0 items-center justify-between border-b border-border-hairline bg-fill-translucent px-4 lg:flex">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Search className="size-5 text-muted-foreground" />
          <div className="flex items-center gap-1 rounded-md bg-fill-subtle px-2 py-1 text-body-3 text-text-secondary">
            <UserRound className="size-3.5" />
            {workspace.user.displayName}
          </div>
          <input
            aria-label="Search reports, domains, people"
            className="h-8 min-w-0 flex-1 border-0 bg-transparent text-body-2 text-foreground outline-none placeholder:text-muted-foreground"
            placeholder="Search reports, domains, people..."
          />
        </div>

        <div className="flex items-center gap-2 pl-4">
          <DashboardPrimaryButton>
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
          <MobileNavSheet workspace={workspace} />
          <span className="min-w-0 truncate text-heading-5 text-foreground">
            {workspace.name}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-2 pl-3">
          <MobileSearchSheet workspace={workspace} />
          <DashboardPrimaryButton ariaLabel="Capture report" className="px-3 sm:px-4">
            <Camera className="size-4" />
            <span className="sr-only sm:not-sr-only">Capture</span>
          </DashboardPrimaryButton>
          {isRightRailEnabled ? <MobileRightRailSheet workspace={workspace} /> : null}
        </div>
      </header>
    </>
  )
}

function WorkspaceRightRailContent({
  className,
  workspace,
}: {
  className?: string
  workspace: MockWorkspace
}) {
  const pathname = usePathname()
  const reportsPath = `/${workspace.slug}/reports`
  const isReportsRoute = pathname === reportsPath || pathname.startsWith(`${reportsPath}/`)

  if (isReportsRoute) {
    return <ReportsContextRail className={className} workspace={workspace} />
  }

  return (
    <div className={cn("feedme-scrollbar-hidden h-full w-right-rail overflow-y-auto", className)}>
      <section className="border-b border-border-hairline px-5 py-6 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full border border-primary-soft/50 [background:var(--gradient-primary-premium)] text-heading-3 text-primary-foreground shadow-[var(--elevation-primary-premium)]">
          {workspace.user.initials}
        </div>
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
  report: MockReportSummary,
  kind: ReportScreenshot["kind"]
) {
  const match = report.viewport.match(/(\d+)\s*x\s*(\d+)/i)
  const width = match ? Number(match[1]) : 1440
  const height = match ? Number(match[2]) : 900

  if (kind === "page") {
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
}: ReportScreenshot & { className?: string }) {
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
      <ReportEvidenceFrame {...screenshot} className="absolute inset-0" />
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
  report: MockReportSummary
}) {
  const total = report.screenshots.length
  const selectedIndex = Math.min(Math.max(activeIndex, 0), total - 1)
  const selectedScreenshot = report.screenshots[selectedIndex] ?? report.screenshots[0]
  const dimensions = selectedScreenshot
    ? getScreenshotDimensions(report, selectedScreenshot.kind)
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
  report: MockReportSummary
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

function ReportInspectorRail({
  className,
  report,
  workspaceSlug,
}: {
  className?: string
  report: MockReportSummary
  workspaceSlug: string
}) {
  return (
    <div className={cn("feedme-scrollbar-hidden h-full w-right-rail overflow-y-auto", className)}>
      <section className="border-b border-border-hairline px-4 py-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <ReportRailBadge className={reportSeverityPillStyles[report.severity]}>
            {report.severity}
          </ReportRailBadge>
          <ReportRailBadge className={reportStatusPillStyles[report.status]}>
            {labelFromToken(report.status)}
          </ReportRailBadge>
        </div>
        <h2 className="mt-3 line-clamp-2 text-heading-5 text-foreground">
          {report.title}
        </h2>
        <p className="mt-2 line-clamp-3 text-body-3 text-text-body">
          {report.summary}
        </p>
      </section>

      <ReportEvidenceTabs report={report} workspaceSlug={workspaceSlug} />

      <section className="grid grid-cols-2 gap-2 border-b border-border-hairline px-4 py-3">
        <ReportRailMeta label="Type" value={report.type} />
        <ReportRailMeta label="Comments" value={report.commentsCount} />
        <ReportRailMeta label="Owner" value={report.assignee?.name ?? "Unassigned"} />
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
        <p className="mt-2 line-clamp-5 rounded-lg border border-border-hairline bg-background p-2.5 text-caption text-text-body">
          {report.developerPrompt}
        </p>
      </section>
    </div>
  )
}

function ReportsContextRail({
  className,
  workspace,
}: {
  className?: string
  workspace: MockWorkspace
}) {
  const searchParams = useSearchParams()
  const reports = getMockReports(workspace.slug)
  const selectedReportId = searchParams.get("report") ?? reports[0]?.id
  const selectedReport = reports.find((report) => report.id === selectedReportId)

  if (!selectedReport) {
    return <EmptyReportRail className={className} />
  }

  return (
    <ReportInspectorRail
      className={className}
      report={selectedReport}
      workspaceSlug={workspace.slug}
    />
  )
}

function MobileRightRailSheet({ workspace }: { workspace: MockWorkspace }) {
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
        className="!w-[min(21rem,calc(100vw-1.5rem))] !max-w-none overflow-hidden border-border-hairline bg-background p-0 text-foreground shadow-popover"
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
        <WorkspaceRightRailContent className="w-full" workspace={workspace} />
      </SheetContent>
    </Sheet>
  )
}

function WorkspaceRightRail({
  isOpen,
  workspace,
}: {
  isOpen: boolean
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
      <WorkspaceRightRailContent workspace={workspace} />
    </aside>
  )
}

export function WorkspaceShell({ children, workspace }: WorkspaceShellProps) {
  const [isRightRailOpen, setIsRightRailOpen] = useState(true)
  const pathname = usePathname()
  const reportsPath = `/${workspace.slug}/reports`
  const isReportDetailRoute = pathname.startsWith(`${reportsPath}/`)
  const isRightRailEnabled = !isReportDetailRoute
  const shouldShowRightRail = isRightRailEnabled && isRightRailOpen

  return (
    <main className="flex h-screen overflow-hidden bg-card text-foreground">
      <WorkspaceSidebar workspace={workspace} />

      <section className="min-w-0 flex-1 p-2 lg:pl-0">
        <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border-hairline bg-background shadow-card">
          <WorkspaceTopbar
            isRightRailOpen={isRightRailOpen}
            isRightRailEnabled={isRightRailEnabled}
            onToggleRightRail={() => setIsRightRailOpen((value) => !value)}
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
              <WorkspaceRightRail isOpen={isRightRailOpen} workspace={workspace} />
            ) : null}
          </div>
        </div>
      </section>
    </main>
  )
}
