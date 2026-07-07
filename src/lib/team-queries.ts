"use client"

import { useQuery } from "@tanstack/react-query"

import { getJson } from "@/lib/api-client"
import { workspaceKeys } from "@/lib/query-keys"
import type { WorkspaceTeamMember } from "@/lib/team-members"

export type WorkspaceMembersResponse = {
  members: WorkspaceTeamMember[]
}

function getWorkspaceMembersUrl(workspaceSlug: string) {
  return `/api/workspaces/${encodeURIComponent(workspaceSlug)}/members`
}

export async function fetchWorkspaceMembers(workspaceSlug: string) {
  return getJson<WorkspaceMembersResponse>(getWorkspaceMembersUrl(workspaceSlug))
}

export function useWorkspaceMembersQuery({
  enabled = true,
  initialMembers,
  workspaceSlug,
}: {
  enabled?: boolean
  initialMembers?: WorkspaceTeamMember[]
  workspaceSlug: string
}) {
  return useQuery({
    enabled,
    initialData: initialMembers ? { members: initialMembers } : undefined,
    queryFn: () => fetchWorkspaceMembers(workspaceSlug),
    queryKey: workspaceKeys.members(workspaceSlug),
    staleTime: 60 * 1000,
  })
}
