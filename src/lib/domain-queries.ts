"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { deleteJson, getJson, postJson } from "@/lib/api-client"
import { workspaceKeys } from "@/lib/query-keys"

export type WorkspaceDomain = {
  id: string
  host: string
  status: "active" | "pending_verification" | "verified" | "disabled"
  verifiedAt: string | null
  createdAt: string
  updatedAt: string
}

export type WorkspaceDomainsResponse = {
  domains: WorkspaceDomain[]
}

export type WorkspaceDomainMutationResponse = {
  domain: WorkspaceDomain
}

type AddDomainVariables = {
  domain: string
}

type DeleteDomainVariables = {
  domainId: string
}

function getWorkspaceDomainsUrl(workspaceSlug: string) {
  return `/api/workspaces/${encodeURIComponent(workspaceSlug)}/domains`
}

function getWorkspaceDomainUrl(workspaceSlug: string, domainId: string) {
  return `${getWorkspaceDomainsUrl(workspaceSlug)}/${encodeURIComponent(domainId)}`
}

export async function fetchWorkspaceDomains(workspaceSlug: string) {
  return getJson<WorkspaceDomainsResponse>(getWorkspaceDomainsUrl(workspaceSlug))
}

export function useWorkspaceDomainsQuery({
  enabled = true,
  workspaceSlug,
}: {
  enabled?: boolean
  workspaceSlug: string
}) {
  return useQuery({
    enabled,
    queryFn: () => fetchWorkspaceDomains(workspaceSlug),
    queryKey: workspaceKeys.domains(workspaceSlug),
    staleTime: 60 * 1000,
  })
}

export function useAddWorkspaceDomainMutation(workspaceSlug: string) {
  const queryClient = useQueryClient()
  const queryKey = workspaceKeys.domains(workspaceSlug)

  return useMutation<WorkspaceDomainMutationResponse, Error, AddDomainVariables>({
    mutationFn: ({ domain }) =>
      postJson<WorkspaceDomainMutationResponse>(
        getWorkspaceDomainsUrl(workspaceSlug),
        { domain }
      ),
    onSuccess: (result) => {
      queryClient.setQueryData<WorkspaceDomainsResponse>(queryKey, (currentData) => {
        if (!currentData) {
          return { domains: [result.domain] }
        }

        if (currentData.domains.some((domain) => domain.id === result.domain.id)) {
          return currentData
        }

        return {
          ...currentData,
          domains: [...currentData.domains, result.domain],
        }
      })
    },
  })
}

export function useDeleteWorkspaceDomainMutation(workspaceSlug: string) {
  const queryClient = useQueryClient()
  const queryKey = workspaceKeys.domains(workspaceSlug)

  return useMutation<
    WorkspaceDomainMutationResponse,
    Error,
    DeleteDomainVariables,
    void
  >({
    mutationFn: ({ domainId }) =>
      deleteJson<WorkspaceDomainMutationResponse>(
        getWorkspaceDomainUrl(workspaceSlug, domainId)
      ),
    onError: () => {
      void queryClient.invalidateQueries({ queryKey })
    },
    onMutate: async ({ domainId }) => {
      await queryClient.cancelQueries({ queryKey })

      queryClient.setQueryData<WorkspaceDomainsResponse>(queryKey, (currentData) => {
        if (!currentData) {
          return currentData
        }

        return {
          ...currentData,
          domains: currentData.domains.filter((domain) => domain.id !== domainId),
        }
      })

    },
  })
}
