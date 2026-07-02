"use client"

import { Plus } from "lucide-react"
import { usePathname, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"

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
import { cn } from "@/lib/utils"

type TeamPageProps = {
  members: WorkspaceTeamMember[]
  workspaceName: string
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
  members,
  workspaceName,
  workspaceSlug,
}: TeamPageProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const initialFilter = getFilter(searchParams)
  const [activeFilter, setActiveFilter] = useState(initialFilter)
  const {
    dashboardSearchQuery,
    registerMembers,
    setSelectedMemberId,
  } = useWorkspaceDashboardData()
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

    setActiveFilter(filter)
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
          </div>
        </div>
      </header>

      {filteredMembers.length === 0 ? (
        <TeamNoMatches
          activeFilterLabel={activeFilterConfig.label}
          searchQuery={searchQuery}
        />
      ) : null}

      {filteredMembers.length > 0 ? (
        <div className="feedme-scrollbar min-h-0 flex-1 overflow-auto">
        <table className="w-full min-w-[820px] border-collapse text-left">
          <caption className="sr-only">Workspace team members</caption>
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
                Reports
              </th>
              <th scope="col" className="px-4 py-3 text-caption font-medium text-text-muted">
                Joined
              </th>
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
                <td className="w-[42%] px-4 py-4 align-top">
                  <div className="flex min-w-0 items-center gap-2">
                    <TeamMemberAvatar member={member} />
                    <div className="min-w-0">
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
                  {member.reportsCount}
                </td>
                <td className="px-4 py-4 align-top text-body-3 text-text-muted">
                  {member.joinedAtLabel}
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
