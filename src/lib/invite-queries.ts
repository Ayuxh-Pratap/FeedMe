"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { getJson, postJson } from "@/lib/api-client"
import { workspaceKeys } from "@/lib/query-keys"

export const inviteRoles = [
  { label: "Reporter", value: "reporter" },
  { label: "Developer", value: "developer" },
  { label: "Designer", value: "designer" },
  { label: "Viewer", value: "viewer" },
] as const

export type InviteRole = (typeof inviteRoles)[number]["value"]

export type WorkspaceInvite = {
  id: string
  workspaceId: string
  code: string
  role: InviteRole
  status: "active" | "revoked" | "expired" | "exhausted"
  expiresAt: string | null
  maxUses: number | null
  usedCount: number
  createdAt: string
  updatedAt: string
  joinPath: string
  inviteUrl: string
}

export type CreatedInvite = Pick<
  WorkspaceInvite,
  "code" | "role" | "joinPath" | "inviteUrl"
>

export type WorkspaceInvitesResponse = {
  invites: WorkspaceInvite[]
}

export type CreateInviteResponse = {
  invite: WorkspaceInvite
}

type CreateInviteVariables = {
  role: InviteRole
}

function getWorkspaceInvitesUrl(workspaceSlug: string) {
  return `/api/workspaces/${encodeURIComponent(workspaceSlug)}/invites`
}

export async function fetchWorkspaceInvites(workspaceSlug: string) {
  return getJson<WorkspaceInvitesResponse>(getWorkspaceInvitesUrl(workspaceSlug))
}

export function useWorkspaceInvitesQuery({
  enabled = true,
  workspaceSlug,
}: {
  enabled?: boolean
  workspaceSlug: string
}) {
  return useQuery({
    enabled,
    queryFn: () => fetchWorkspaceInvites(workspaceSlug),
    queryKey: workspaceKeys.invites(workspaceSlug),
    staleTime: 30 * 1000,
  })
}

export function useCreateWorkspaceInviteMutation(workspaceSlug: string) {
  const queryClient = useQueryClient()
  const queryKey = workspaceKeys.invites(workspaceSlug)

  return useMutation<CreateInviteResponse, Error, CreateInviteVariables>({
    mutationFn: ({ role }) =>
      postJson<CreateInviteResponse>(getWorkspaceInvitesUrl(workspaceSlug), {
        role,
      }),
    onSuccess: (result) => {
      queryClient.setQueryData<WorkspaceInvitesResponse>(queryKey, (currentData) => {
        if (!currentData) {
          return { invites: [result.invite] }
        }

        if (currentData.invites.some((invite) => invite.id === result.invite.id)) {
          return currentData
        }

        return {
          ...currentData,
          invites: [result.invite, ...currentData.invites],
        }
      })
    },
  })
}

export function labelFromInviteRole(role: InviteRole) {
  return inviteRoles.find((item) => item.value === role)?.label ?? "Reporter"
}
