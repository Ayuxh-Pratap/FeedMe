"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { deleteJson, getJson, postJson } from "@/lib/api-client"
import { workspaceKeys } from "@/lib/query-keys"

export type AgentToken = {
  id: string
  label: string
  lastUsedAt: string | null
  revokedAt: string | null
  createdAt: string
}

export type TokensResponse = {
  tokens: AgentToken[]
}

export type CreateTokenResponse = {
  token: string
  tokenRecord: {
    id: string
    label: string
    createdAt: string
  }
}

type CreateTokenVariables = {
  label: string
}

type RevokeTokenVariables = {
  tokenId: string
}

type TokenMutationContext = {
  previousTokens?: TokensResponse
}

function getWorkspaceTokensUrl(workspaceSlug: string) {
  return `/api/workspaces/${encodeURIComponent(workspaceSlug)}/tokens`
}

function getWorkspaceTokenUrl(workspaceSlug: string, tokenId: string) {
  return `${getWorkspaceTokensUrl(workspaceSlug)}/${encodeURIComponent(tokenId)}`
}

export async function fetchWorkspaceTokens(workspaceSlug: string) {
  return getJson<TokensResponse>(getWorkspaceTokensUrl(workspaceSlug))
}

export function useWorkspaceTokensQuery({
  enabled = true,
  workspaceSlug,
}: {
  enabled?: boolean
  workspaceSlug: string
}) {
  return useQuery({
    enabled,
    queryFn: () => fetchWorkspaceTokens(workspaceSlug),
    queryKey: workspaceKeys.tokens(workspaceSlug),
    staleTime: 60 * 1000,
  })
}

export function useCreateWorkspaceTokenMutation(workspaceSlug: string) {
  const queryClient = useQueryClient()
  const queryKey = workspaceKeys.tokens(workspaceSlug)

  return useMutation<CreateTokenResponse, Error, CreateTokenVariables>({
    mutationFn: ({ label }) =>
      postJson<CreateTokenResponse>(getWorkspaceTokensUrl(workspaceSlug), {
        label,
      }),
    onSuccess: (result) => {
      queryClient.setQueryData<TokensResponse>(queryKey, (currentData) => {
        const nextToken: AgentToken = {
          id: result.tokenRecord.id,
          label: result.tokenRecord.label,
          lastUsedAt: null,
          revokedAt: null,
          createdAt: result.tokenRecord.createdAt,
        }

        if (!currentData) {
          return { tokens: [nextToken] }
        }

        if (currentData.tokens.some((token) => token.id === nextToken.id)) {
          return currentData
        }

        return {
          ...currentData,
          tokens: [nextToken, ...currentData.tokens],
        }
      })
    },
  })
}

export function useRevokeWorkspaceTokenMutation(workspaceSlug: string) {
  const queryClient = useQueryClient()
  const queryKey = workspaceKeys.tokens(workspaceSlug)

  return useMutation<
    { revoked: true },
    Error,
    RevokeTokenVariables,
    TokenMutationContext
  >({
    mutationFn: ({ tokenId }) =>
      deleteJson<{ revoked: true }>(getWorkspaceTokenUrl(workspaceSlug, tokenId)),
    onError: (_error, _variables, context) => {
      if (context?.previousTokens) {
        queryClient.setQueryData(queryKey, context.previousTokens)
      }
    },
    onMutate: async ({ tokenId }) => {
      await queryClient.cancelQueries({ queryKey })

      const previousTokens = queryClient.getQueryData<TokensResponse>(queryKey)
      const revokedAt = new Date().toISOString()

      queryClient.setQueryData<TokensResponse>(queryKey, (currentData) => {
        if (!currentData) {
          return currentData
        }

        return {
          ...currentData,
          tokens: currentData.tokens.map((token) =>
            token.id === tokenId ? { ...token, revokedAt } : token
          ),
        }
      })

      return { previousTokens }
    },
  })
}
