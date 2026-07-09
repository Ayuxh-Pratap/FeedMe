"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { getJson, patchJson } from "@/lib/api-client"
import { workspaceKeys } from "@/lib/query-keys"
import type {
  MarkWorkspaceNotificationsReadResponse,
  WorkspaceNotificationsResponse,
} from "@/lib/notifications"

type MarkNotificationsReadVariables = {
  notificationIds?: string[]
}

function getWorkspaceNotificationsUrl(workspaceSlug: string) {
  return `/api/workspaces/${encodeURIComponent(workspaceSlug)}/notifications?limit=20`
}

export function useWorkspaceNotificationsQuery(workspaceSlug: string) {
  return useQuery({
    queryFn: () =>
      getJson<WorkspaceNotificationsResponse>(
        getWorkspaceNotificationsUrl(workspaceSlug)
      ),
    queryKey: workspaceKeys.notifications(workspaceSlug),
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    staleTime: 5_000,
  })
}

export function useMarkWorkspaceNotificationsReadMutation(workspaceSlug: string) {
  const queryClient = useQueryClient()

  return useMutation<
    MarkWorkspaceNotificationsReadResponse,
    Error,
    MarkNotificationsReadVariables,
    { previousData?: WorkspaceNotificationsResponse }
  >({
    mutationFn: ({ notificationIds }) =>
      patchJson<MarkWorkspaceNotificationsReadResponse>(
        `/api/workspaces/${encodeURIComponent(workspaceSlug)}/notifications`,
        { notificationIds }
      ),
    onError: (_error, _variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(
          workspaceKeys.notifications(workspaceSlug),
          context.previousData
        )
      }
    },
    onMutate: async ({ notificationIds }) => {
      const queryKey = workspaceKeys.notifications(workspaceSlug)

      await queryClient.cancelQueries({ queryKey })

      const previousData =
        queryClient.getQueryData<WorkspaceNotificationsResponse>(queryKey)
      const idsToRead = notificationIds ? new Set(notificationIds) : null
      const now = new Date().toISOString()

      if (previousData) {
        let unreadCount = previousData.unreadCount
        const notifications = previousData.notifications.map((notification) => {
          const shouldMarkRead = idsToRead
            ? idsToRead.has(notification.id)
            : !notification.readAt

          if (shouldMarkRead && !notification.readAt) {
            unreadCount -= 1
          }

          return shouldMarkRead
            ? {
                ...notification,
                readAt: notification.readAt ?? now,
              }
            : notification
        })

        queryClient.setQueryData<WorkspaceNotificationsResponse>(queryKey, {
          notifications,
          unreadCount: idsToRead ? Math.max(0, unreadCount) : 0,
        })
      }

      return { previousData }
    },
    onSuccess: (result) => {
      queryClient.setQueryData(
        workspaceKeys.notifications(workspaceSlug),
        result
      )
    },
  })
}
