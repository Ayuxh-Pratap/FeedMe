"use client"

import {
  Check,
  KeyRound,
  MoreHorizontal,
  Plus,
  ShieldOff,
  Trash2,
  UserCheck,
} from "lucide-react"
import { usePathname, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"

import {
  DashboardTeamTableSkeleton,
} from "@/components/feedme/dashboard/dashboard-route-loading"
import {
  DashboardCenteredError,
  DashboardInlineError,
} from "@/components/feedme/dashboard/dashboard-query-status"
import { FeedMeAvatar } from "@/components/feedme/dashboard/feedme-avatar"
import { InviteMemberDialog } from "@/components/feedme/dashboard/invite-member-dialog"
import { useWorkspaceDashboardData } from "@/components/feedme/dashboard/workspace-dashboard-data"
import {
  matchesWorkspaceMemberSearch,
} from "@/lib/dashboard-search"
import { replaceUrlSearchParams } from "@/lib/dashboard-url"
import {
  getWorkspaceMemberRoleLabel,
  type WorkspaceTeamMember,
} from "@/lib/team-members"
import {
  useRemoveWorkspaceMemberMutation,
  useRevokeWorkspaceMemberTokensMutation,
  useUpdateWorkspaceMemberMutation,
  useWorkspaceMembersQuery,
} from "@/lib/team-queries"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { ApiClientError } from "@/lib/api-client"

type TeamPageProps = {
  members?: WorkspaceTeamMember[]
  workspaceName?: string
  workspaceSlug: string
}

type TeamFilter = "all" | "developer" | "designer" | "reporter" | "pending"
type SearchParamsLike = {
  get: (name: string) => string | null
}

const filters: {
  label: string
  value: TeamFilter
  match: (member: WorkspaceTeamMember) => boolean
}[] = [
  { label: "All", value: "all", match: () => true },
  {
    label: "Developers",
    value: "developer",
    match: (member) => member.role === "developer",
  },
  {
    label: "Designers",
    value: "designer",
    match: (member) => member.role === "designer",
  },
  {
    label: "Reporters",
    value: "reporter",
    match: (member) => member.role === "reporter",
  },
  {
    label: "Pending",
    value: "pending",
    match: (member) => member.status === "pending",
  },
]
const emptyMembers: WorkspaceTeamMember[] = []

function getFilter(searchParams: SearchParamsLike): TeamFilter {
  const value = searchParams.get("role")

  if (
    value === "developer" ||
    value === "designer" ||
    value === "reporter" ||
    value === "pending"
  ) {
    return value
  }

  return "all"
}

function RolePill({ role }: { role: WorkspaceTeamMember["role"] }) {
  return (
    <span className="inline-flex h-5 items-center rounded-md border border-border-hairline bg-fill-translucent px-1.5 text-caption font-medium text-text-secondary">
      {getWorkspaceMemberRoleLabel(role)}
    </span>
  )
}

function TeamMemberAvatar({ member }: { member: WorkspaceTeamMember }) {
  return (
    <FeedMeAvatar
      displayValue={member.initials}
      imageUrl={member.avatarUrl}
      label={member.name}
      size={28}
      value={member.email}
    />
  )
}

const managedRoles = ["admin", "developer", "designer", "reporter", "viewer"] as const
type ConfirmAction = "disable" | "remove" | "revoke_tokens"

function MemberAccessMenu({
  actorRole,
  actorUserId,
  member,
  onError,
  workspaceSlug,
}: {
  actorRole: WorkspaceTeamMember["role"]
  actorUserId: string
  member: WorkspaceTeamMember
  onError: (message: string) => void
  workspaceSlug: string
}) {
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null)
  const updateMember = useUpdateWorkspaceMemberMutation(workspaceSlug)
  const removeMember = useRemoveWorkspaceMemberMutation(workspaceSlug)
  const revokeTokens = useRevokeWorkspaceMemberTokensMutation(workspaceSlug)
  const canManage =
    (actorRole === "owner" || actorRole === "admin") &&
    actorUserId !== member.userId &&
    member.role !== "owner" &&
    !(actorRole === "admin" && member.role === "admin")

  if (!canManage) return null

  async function run(action: () => Promise<unknown>) {
    try {
      await action()
    } catch (error) {
      onError(error instanceof ApiClientError ? error.message : "Unable to update this member.")
    }
  }

  async function confirm() {
    const action = confirmAction
    setConfirmAction(null)
    if (action === "disable") {
      await run(() => updateMember.mutateAsync({ memberUserId: member.userId, status: "disabled" }))
    } else if (action === "remove") {
      await run(() => removeMember.mutateAsync({ memberUserId: member.userId }))
    } else if (action === "revoke_tokens") {
      await run(() => revokeTokens.mutateAsync({ memberUserId: member.userId }))
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" aria-label={`Manage ${member.name}`} onClick={(event) => event.stopPropagation()} className="flex size-8 items-center justify-center rounded-lg border border-border-hairline bg-fill-translucent text-text-body hover:bg-fill-subtle hover:text-foreground">
            <MoreHorizontal className="size-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52 rounded-lg border border-border-hairline bg-surface-card">
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="rounded-md text-body-3">Change role</DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="rounded-lg border border-border-hairline bg-surface-card">
              {managedRoles
                .filter((role) => actorRole === "owner" || role !== "admin")
                .map((role) => (
                  <DropdownMenuItem key={role} onSelect={() => void run(() => updateMember.mutateAsync({ memberUserId: member.userId, role }))} className="rounded-md text-body-3">
                    <span className="flex-1">{getWorkspaceMemberRoleLabel(role)}</span>
                    {member.role === role ? <Check className="size-3.5" /> : null}
                  </DropdownMenuItem>
                ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          {member.status === "disabled" ? (
            <DropdownMenuItem onSelect={() => void run(() => updateMember.mutateAsync({ memberUserId: member.userId, status: "active" }))} className="rounded-md text-body-3"><UserCheck className="size-4" />Restore access</DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => setConfirmAction("disable")} className="rounded-md text-body-3"><ShieldOff className="size-4" />Disable access</DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={() => setConfirmAction("revoke_tokens")} className="rounded-md text-body-3"><KeyRound className="size-4" />Revoke MCP tokens</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirmAction("remove")} className="rounded-md text-body-3"><Trash2 className="size-4" />Remove member</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmAction !== null} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <AlertDialogContent className="rounded-xl border border-border-hairline bg-surface-card">
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmAction === "remove" ? "Remove member?" : confirmAction === "disable" ? "Disable access?" : "Revoke MCP tokens?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction === "remove"
                ? `${member.name} will lose workspace access and active assignments will be released.`
                : confirmAction === "disable"
                  ? `${member.name} will be signed out of workspace integrations and active assignments will be released.`
                  : `Every active MCP token owned by ${member.name} in this workspace will stop working.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => void confirm()}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function TeamFilterTabs({
  activeFilter,
  members,
  onFilterChange,
}: {
  activeFilter: TeamFilter
  members: WorkspaceTeamMember[]
  onFilterChange: (filter: TeamFilter) => void
}) {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-border-hairline bg-fill-translucent p-1">
      {filters.map((filter) => {
        const active = activeFilter === filter.value
        const count = members.filter(filter.match).length

        return (
          <button
            key={filter.value}
            type="button"
            onClick={() => onFilterChange(filter.value)}
            className={cn(
              "inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md px-2.5 text-heading-5 transition-all duration-base ease-out-soft active:scale-[var(--press-scale)]",
              active
                ? "bg-surface-raised text-foreground shadow-button-hover"
                : "text-text-body hover:bg-fill-subtle hover:text-foreground"
            )}
          >
            {filter.label}
            <span className="text-caption text-text-muted">{count}</span>
          </button>
        )
      })}
    </div>
  )
}

function TeamNoMatches({
  activeFilterLabel,
  searchQuery,
}: {
  activeFilterLabel: string
  searchQuery: string
}) {
  const hasSearch = Boolean(searchQuery)

  return (
    <div className="flex min-h-0 flex-1 items-center justify-center px-8 py-10">
      <div className="mx-auto max-w-[360px] text-center">
        <h2 className="text-heading-3 text-foreground">
          {hasSearch ? "No matching teammates" : "No teammates in this view"}
        </h2>
        <p className="mt-2 text-body-2 text-text-body">
          {hasSearch
            ? `Nothing matched "${searchQuery}" inside ${activeFilterLabel.toLowerCase()}.`
            : "Try a different role filter to see more workspace members."}
        </p>
      </div>
    </div>
  )
}

export function TeamPage({
  members: initialMembers,
  workspaceName: initialWorkspaceName,
  workspaceSlug,
}: TeamPageProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const activeFilter = getFilter(searchParams)
  const {
    currentUserId,
    currentUserRole,
    dashboardSearchQuery,
    registerMembers,
    setSelectedMemberId,
    workspaceName: contextWorkspaceName,
  } = useWorkspaceDashboardData()
  const [memberActionError, setMemberActionError] = useState<string | null>(null)
  const membersQuery = useWorkspaceMembersQuery({
    initialMembers,
    workspaceSlug,
  })
  const members = membersQuery.data?.members ?? emptyMembers
  const workspaceName = initialWorkspaceName ?? contextWorkspaceName
  const searchQuery = dashboardSearchQuery
  const activeFilterConfig =
    filters.find((filter) => filter.value === activeFilter) ?? filters[0]
  const searchScopedMembers = useMemo(
    () =>
      members.filter((member) =>
        matchesWorkspaceMemberSearch(member, searchQuery)
      ),
    [members, searchQuery]
  )
  const filteredMembers = useMemo(
    () => searchScopedMembers.filter(activeFilterConfig.match),
    [activeFilterConfig, searchScopedMembers]
  )
  const requestedMemberId = searchParams.get("member")
  const initialSelectedMemberId = filteredMembers.some(
      (member) => member.id === requestedMemberId
    )
      ? requestedMemberId
      : filteredMembers[0]?.id
  const [selectedMemberId, setLocalSelectedMemberId] = useState(
    initialSelectedMemberId
  )
  const effectiveSelectedMemberId = filteredMembers.some(
    (member) => member.id === selectedMemberId
  )
    ? selectedMemberId
    : filteredMembers[0]?.id
  const showInitialSkeleton = membersQuery.isPending && members.length === 0
  const errorMessage =
    membersQuery.error instanceof Error
      ? membersQuery.error.message
      : membersQuery.isError
        ? "Unable to load team members. Please try again."
        : null
  const showInitialError =
    Boolean(errorMessage) && members.length === 0 && !showInitialSkeleton
  const showInlineError = Boolean(errorMessage) && members.length > 0

  const replaceSearchParams = useCallback((nextSearchParams: URLSearchParams) => {
    replaceUrlSearchParams(pathname, nextSearchParams)
  }, [pathname])

  const getCurrentSearchParams = useCallback(() => {
    return new URLSearchParams(searchParams.toString())
  }, [searchParams])

  function changeFilter(filter: TeamFilter) {
    const nextSearchParams = getCurrentSearchParams()
    const nextFilter = filters.find((item) => item.value === filter) ?? filters[0]
    const nextMembers = searchScopedMembers.filter(nextFilter.match)
    const nextSelectedMemberId = nextMembers[0]?.id

    setLocalSelectedMemberId(nextSelectedMemberId)
    setSelectedMemberId(nextSelectedMemberId ?? null)

    if (filter === "all") {
      nextSearchParams.delete("role")
    } else {
      nextSearchParams.set("role", filter)
    }

    if (nextSelectedMemberId) {
      nextSearchParams.set("member", nextSelectedMemberId)
    } else {
      nextSearchParams.delete("member")
    }

    replaceSearchParams(nextSearchParams)
  }

  function selectMember(memberId: string) {
    setLocalSelectedMemberId(memberId)
    setSelectedMemberId(memberId)

    const nextSearchParams = getCurrentSearchParams()
    nextSearchParams.set("member", memberId)
    replaceSearchParams(nextSearchParams)
  }

  useEffect(() => {
    if (showInitialSkeleton) {
      return
    }

    const nextSelectedMemberId = effectiveSelectedMemberId ?? null

    registerMembers({
      members,
      selectedMemberId: nextSelectedMemberId,
      visibleMemberIds: filteredMembers.map((member) => member.id),
    })
    setSelectedMemberId(nextSelectedMemberId)
  }, [
    effectiveSelectedMemberId,
    filteredMembers,
    members,
    registerMembers,
    setSelectedMemberId,
    showInitialSkeleton,
  ])

  return (
    <section className="flex h-full min-h-0 flex-col">
      <header className="shrink-0 border-b border-border-hairline px-4 py-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h1 className="text-heading-3 text-foreground">Team</h1>
            <p className="mt-1 text-body-3 text-text-body">
              Manage workspace members, roles, and feedback ownership.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <TeamFilterTabs
              activeFilter={activeFilter}
              members={searchScopedMembers}
              onFilterChange={changeFilter}
            />
            {currentUserRole === "owner" || currentUserRole === "admin" ? (
              <InviteMemberDialog
                workspaceName={workspaceName}
                workspaceSlug={workspaceSlug}
              >
                <button
                  type="button"
                  aria-label="Invite member"
                  className="flex size-9 cursor-pointer items-center justify-center rounded-lg border border-border-hairline bg-fill-translucent text-text-body shadow-button-secondary transition-all duration-base ease-out-soft hover:bg-fill-subtle hover:text-foreground hover:shadow-button-hover active:scale-[var(--press-scale)]"
                >
                  <Plus className="size-4" />
                </button>
              </InviteMemberDialog>
            ) : null}
          </div>
        </div>
      </header>

      {showInlineError && errorMessage ? (
        <DashboardInlineError
          isRetrying={membersQuery.isRefetching}
          message={errorMessage}
          onRetry={() => {
            void membersQuery.refetch()
          }}
        />
      ) : null}

      {memberActionError ? (
        <DashboardInlineError
          isRetrying={false}
          message={memberActionError}
          onRetry={() => setMemberActionError(null)}
        />
      ) : null}

      {showInitialSkeleton ? <DashboardTeamTableSkeleton /> : null}

      {showInitialError && errorMessage ? (
        <DashboardCenteredError
          isRetrying={membersQuery.isFetching}
          message={errorMessage}
          onRetry={() => {
            void membersQuery.refetch()
          }}
          title="Unable to load team"
        />
      ) : null}

      {!showInitialSkeleton && !showInitialError && filteredMembers.length === 0 ? (
        <TeamNoMatches
          activeFilterLabel={activeFilterConfig.label}
          searchQuery={searchQuery}
        />
      ) : null}

      {!showInitialSkeleton && !showInitialError && filteredMembers.length > 0 ? (
        <div className="feedme-scrollbar min-h-0 flex-1 overflow-auto">
        <table className="w-full min-w-[900px] table-fixed border-collapse text-left">
          <caption className="sr-only">Workspace team members</caption>
          <colgroup>
            <col className="w-[39%]" />
            <col className="w-[13%]" />
            <col className="w-[10%]" />
            <col className="w-[11%]" />
            <col className="w-[10%]" />
            <col className="w-[11%]" />
            <col className="w-[6%]" />
          </colgroup>
          <thead className="sticky top-0 z-10 border-b border-border-hairline bg-background">
            <tr>
              <th scope="col" className="px-4 py-3 text-caption font-medium text-text-muted">
                Member
              </th>
              <th scope="col" className="px-4 py-3 text-caption font-medium text-text-muted">
                Role
              </th>
              <th scope="col" className="px-4 py-3 text-caption font-medium text-text-muted">
                Assigned
              </th>
              <th scope="col" className="px-4 py-3 text-caption font-medium text-text-muted">
                Completed
              </th>
              <th scope="col" className="px-4 py-3 text-caption font-medium text-text-muted">
                Reports
              </th>
              <th scope="col" className="px-4 py-3 text-caption font-medium text-text-muted">
                Joined
              </th>
              <th scope="col" className="px-2 py-3"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {filteredMembers.map((member) => {
              const selected = member.id === effectiveSelectedMemberId

              return (
              <tr
                key={member.id}
                role="button"
                tabIndex={0}
                onClick={() => selectMember(member.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault()
                    selectMember(member.id)
                  }
                }}
                className={cn(
                  "cursor-pointer border-b border-border-hairline outline-none transition-colors duration-base ease-out-soft hover:bg-fill-translucent focus-visible:bg-fill-subtle",
                  selected && "bg-fill-subtle"
                )}
              >
                <td className="max-w-0 px-4 py-4 align-top">
                  <div className="flex min-w-0 items-center gap-2">
                    <TeamMemberAvatar member={member} />
                    <div className="min-w-0 max-w-full">
                      <p className="truncate text-heading-5 text-foreground">
                        {member.name}
                      </p>
                      <p className="mt-0.5 truncate text-body-3 text-text-muted">
                        {member.email}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4 align-top">
                  <RolePill role={member.role} />
                </td>
                <td className="px-4 py-4 align-top text-body-3 text-text-secondary">
                  {member.assignedCount}
                </td>
                <td className="px-4 py-4 align-top text-body-3 text-text-secondary">
                  {member.completedCount}
                </td>
                <td className="px-4 py-4 align-top text-body-3 text-text-secondary">
                  {member.reportsCount}
                </td>
                <td className="max-w-0 px-4 py-4 align-top text-body-3 text-text-muted">
                  <span className="block truncate">{member.joinedAtLabel}</span>
                </td>
                <td className="px-2 py-3 align-top" onClick={(event) => event.stopPropagation()}>
                  <MemberAccessMenu
                    actorRole={currentUserRole}
                    actorUserId={currentUserId}
                    member={member}
                    onError={setMemberActionError}
                    workspaceSlug={workspaceSlug}
                  />
                </td>
              </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      ) : null}
    </section>
  )
}
