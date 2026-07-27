"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { deleteJson, getJson, patchJson } from "@/lib/api-client"
import { reportKeys, workspaceKeys } from "@/lib/query-keys"
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

type UpdateMemberInput = {
  memberUserId: string
  role?: WorkspaceTeamMember["role"]
  status?: "active" | "disabled"
}

export function useUpdateWorkspaceMemberMutation(workspaceSlug: string) {
  const queryClient = useQueryClient()
  const queryKey = workspaceKeys.members(workspaceSlug)

  return useMutation<WorkspaceMembersResponse, Error, UpdateMemberInput, void>({
    mutationFn: ({ memberUserId, ...input }) =>
      patchJson<WorkspaceMembersResponse>(
        `${getWorkspaceMembersUrl(workspaceSlug)}/${encodeURIComponent(memberUserId)}`,
        input
      ),
    onMutate: async ({ memberUserId, role, status }) => {
      await queryClient.cancelQueries({ queryKey })
      queryClient.setQueryData<WorkspaceMembersResponse>(queryKey, (current) =>
        current
          ? {
              members: current.members.map((member) =>
                member.userId === memberUserId
                  ? { ...member, ...(role ? { role } : {}), ...(status ? { status } : {}) }
                  : member
              ),
            }
          : current
      )
    },
    onError: () => {
      void queryClient.invalidateQueries({ queryKey })
    },
    onSuccess: (result) => {
      queryClient.setQueryData(queryKey, result)
      void queryClient.invalidateQueries({ queryKey: reportKeys.all(workspaceSlug) })
    },
  })
}

export function useRemoveWorkspaceMemberMutation(workspaceSlug: string) {
  const queryClient = useQueryClient()
  const queryKey = workspaceKeys.members(workspaceSlug)

  return useMutation<WorkspaceMembersResponse, Error, { memberUserId: string }, void>({
    mutationFn: ({ memberUserId }) =>
      deleteJson<WorkspaceMembersResponse>(
        `${getWorkspaceMembersUrl(workspaceSlug)}/${encodeURIComponent(memberUserId)}`
      ),
    onMutate: async ({ memberUserId }) => {
      await queryClient.cancelQueries({ queryKey })
      queryClient.setQueryData<WorkspaceMembersResponse>(queryKey, (current) =>
        current
          ? { members: current.members.filter((member) => member.userId !== memberUserId) }
          : current
      )
    },
    onError: () => {
      void queryClient.invalidateQueries({ queryKey })
    },
    onSuccess: (result) => {
      queryClient.setQueryData(queryKey, result)
      void queryClient.invalidateQueries({ queryKey: reportKeys.all(workspaceSlug) })
    },
  })
}

export function useRevokeWorkspaceMemberTokensMutation(workspaceSlug: string) {
  return useMutation<{ revokedCount: number }, Error, { memberUserId: string }>({
    mutationFn: ({ memberUserId }) =>
      deleteJson<{ revokedCount: number }>(
        `${getWorkspaceMembersUrl(workspaceSlug)}/${encodeURIComponent(memberUserId)}/tokens`
      ),
  })
}
