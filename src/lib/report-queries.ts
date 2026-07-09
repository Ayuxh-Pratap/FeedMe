"use client"

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
  type QueryKey,
} from "@tanstack/react-query"
import { useCallback, useEffect } from "react"

import { deleteJson, getJson, patchJson, postJson, putJson } from "@/lib/api-client"
import {
  reportKeys,
  type ReportCountFilters,
  type ReportListFilters,
} from "@/lib/query-keys"
import type {
  WorkspaceReport,
  WorkspaceReportActivityItem,
  WorkspaceReportComment,
  WorkspaceReportCommentReactionKind,
  WorkspaceReportCommentMutationResponse,
  WorkspaceReportCommentsPageInfo,
  WorkspaceReportCommentsResponse,
  WorkspaceReportImplementationBrief,
  WorkspaceReportNoteKind,
  WorkspaceReportCountsResponse,
  WorkspaceReportDetailResponse,
  WorkspaceReportsListResponse,
} from "@/lib/reports"

export type ReportMutationResponse = {
  report: WorkspaceReport
}

type CachedReportSnapshot = Array<[QueryKey, unknown]>
type ReportsInfiniteData = InfiniteData<WorkspaceReportsListResponse, string | null>
type ReportsListQueryKey =
  | ReturnType<typeof reportKeys.list>
  | ReturnType<typeof reportKeys.myWork>
type ReportMutationContext = {
  snapshots: CachedReportSnapshot
}

type AssignReportVariables = {
  assignee?: WorkspaceReport["assignee"]
  assigneeUserId: string | null
  report: WorkspaceReport
}

type UpdateReportStatusVariables = {
  note?: string
  report: WorkspaceReport
  status: WorkspaceReport["status"]
}

type UpdateReportImplementationBriefVariables = {
  implementationBrief: WorkspaceReportImplementationBrief
  report: WorkspaceReport
}

type CreateReportNoteVariables = {
  body: string
  kind: WorkspaceReportNoteKind
  optimisticActivityItem: WorkspaceReportActivityItem
  report: WorkspaceReport
}

type CreateReportCommentVariables = {
  body: string
  onOptimisticCommit?: () => void
  optimisticComment: WorkspaceReportComment
  parentCommentId?: string | null
  report: WorkspaceReport
}

type UpdateReportCommentVariables = {
  body: string
  comment: WorkspaceReportComment
  optimisticComment: WorkspaceReportComment
  report: WorkspaceReport
}

type DeleteReportCommentVariables = {
  comment: WorkspaceReportComment
  optimisticComment: WorkspaceReportComment
  report: WorkspaceReport
}

type UpdateReportCommentReactionVariables = {
  comment: WorkspaceReportComment
  enabled: boolean
  reaction: WorkspaceReportCommentReactionKind
  report: WorkspaceReport
}

type LoadReportCommentsVariables = {
  cursor?: string | null
  limit?: number
  parentCommentId?: string | null
  report: WorkspaceReport
}

type WorkspaceReportCommentDeleteResponse =
  WorkspaceReportCommentMutationResponse & {
    removed: boolean
  }

const refetchVisibleReportsIntervalMs = 15_000
const optimisticUnassignResetStatuses: WorkspaceReport["status"][] = [
  "assigned",
  "in_progress",
  "ready_for_review",
]

function getReportsListUrl({
  cursor,
  filters,
  workspaceSlug,
}: {
  cursor?: string | null
  filters: ReportListFilters
  workspaceSlug: string
}) {
  const searchParams = new URLSearchParams({
    limit: String(filters.limit ?? 30),
    sort: filters.sort ?? "newest",
    status: filters.status ?? "all",
  })

  if (cursor) {
    searchParams.set("cursor", cursor)
  }

  if (filters.q?.trim()) {
    searchParams.set("q", filters.q.trim())
  }

  if (filters.scope) {
    searchParams.set("scope", filters.scope)
  }

  return `/api/workspaces/${encodeURIComponent(workspaceSlug)}/reports?${searchParams}`
}

function getReportDetailUrl(workspaceSlug: string, reportId: string) {
  return `/api/workspaces/${encodeURIComponent(workspaceSlug)}/reports/${encodeURIComponent(reportId)}`
}

function getReportCommentsUrl({
  cursor,
  limit = 10,
  parentCommentId,
  reportId,
  workspaceSlug,
}: {
  cursor?: string | null
  limit?: number
  parentCommentId?: string | null
  reportId: string
  workspaceSlug: string
}) {
  const searchParams = new URLSearchParams({
    limit: String(limit),
  })

  if (cursor) {
    searchParams.set("cursor", cursor)
  }

  if (parentCommentId) {
    searchParams.set("parentCommentId", parentCommentId)
  }

  return `${getReportDetailUrl(workspaceSlug, reportId)}/comments?${searchParams}`
}

function getReportCommentMutationUrl({
  commentId,
  reportId,
  workspaceSlug,
}: {
  commentId: string
  reportId: string
  workspaceSlug: string
}) {
  return `${getReportDetailUrl(workspaceSlug, reportId)}/comments/${encodeURIComponent(commentId)}`
}

function getReportCountsUrl({
  filters,
  workspaceSlug,
}: {
  filters: ReportCountFilters
  workspaceSlug: string
}) {
  const searchParams = new URLSearchParams()

  if (filters.q?.trim()) {
    searchParams.set("q", filters.q.trim())
  }

  if (filters.scope) {
    searchParams.set("scope", filters.scope)
  }

  const queryString = searchParams.toString()

  return `/api/workspaces/${encodeURIComponent(workspaceSlug)}/reports/counts${
    queryString ? `?${queryString}` : ""
  }`
}

export function getReportMutationBaseUrl(workspaceSlug: string, reportId: string) {
  return getReportDetailUrl(workspaceSlug, reportId)
}

export async function fetchReportsList({
  cursor,
  filters,
  workspaceSlug,
}: {
  cursor?: string | null
  filters: ReportListFilters
  workspaceSlug: string
}) {
  return getJson<WorkspaceReportsListResponse>(
    getReportsListUrl({ cursor, filters, workspaceSlug })
  )
}

export async function fetchReportDetail(workspaceSlug: string, reportId: string) {
  return getJson<WorkspaceReportDetailResponse>(
    getReportDetailUrl(workspaceSlug, reportId)
  )
}

export async function fetchReportComments({
  cursor,
  limit,
  parentCommentId,
  reportId,
  workspaceSlug,
}: {
  cursor?: string | null
  limit?: number
  parentCommentId?: string | null
  reportId: string
  workspaceSlug: string
}) {
  return getJson<WorkspaceReportCommentsResponse>(
    getReportCommentsUrl({ cursor, limit, parentCommentId, reportId, workspaceSlug })
  )
}

export async function fetchReportCounts({
  filters,
  workspaceSlug,
}: {
  filters: ReportCountFilters
  workspaceSlug: string
}) {
  return getJson<WorkspaceReportCountsResponse>(
    getReportCountsUrl({ filters, workspaceSlug })
  )
}

export function makeInitialReportsInfiniteData(
  reports: WorkspaceReport[],
  pageInfo: WorkspaceReportsListResponse["pageInfo"]
): ReportsInfiniteData {
  return {
    pageParams: [null],
    pages: [
      {
        pageInfo,
        reports,
      },
    ],
  }
}

export function flattenReportPages(
  data: ReportsInfiniteData | undefined
) {
  if (!data) {
    return []
  }

  const reportsById = new Map<string, WorkspaceReport>()

  for (const page of data.pages) {
    for (const report of page.reports) {
      reportsById.set(report.id, report)
    }
  }

  return [...reportsById.values()]
}

export function countUnseenReports({
  currentReports,
  incomingReports,
}: {
  currentReports: WorkspaceReport[]
  incomingReports: WorkspaceReport[]
}) {
  const currentReportIds = new Set(currentReports.map((report) => report.id))

  return incomingReports.filter((report) => !currentReportIds.has(report.id)).length
}

function patchReportList(
  reports: WorkspaceReport[],
  nextReport: WorkspaceReport
) {
  return reports.map((report) =>
    report.id === nextReport.id ? mergeReportCacheEntry(report, nextReport) : report
  )
}

function addCommentToTree(
  comments: WorkspaceReportComment[],
  nextComment: WorkspaceReportComment
): WorkspaceReportComment[] {
  if (comments.some((comment) => comment.id === nextComment.id)) {
    return comments.map((comment) =>
      comment.id === nextComment.id
        ? mergeReportComment(comment, nextComment)
        : comment
    )
  }

  if (!nextComment.parentCommentId) {
    return [...comments, nextComment]
  }

  return comments.map((comment) => {
    if (comment.id === nextComment.parentCommentId) {
      const hasReply = comment.replies.some((reply) => reply.id === nextComment.id)
      const replies = hasReply
        ? comment.replies
        : [...comment.replies, nextComment]

      return {
        ...comment,
        replies,
        replyCount: hasReply
          ? comment.replyCount
          : Math.max(comment.replyCount + 1, replies.length),
      }
    }

    return {
      ...comment,
      replies: addCommentToTree(comment.replies, nextComment),
    }
  })
}

function mergeCommentTrees(
  currentComments: WorkspaceReportComment[] = [],
  nextComments: WorkspaceReportComment[] = []
) {
  return nextComments.reduce(
    (comments, comment) => addCommentToTree(comments, comment),
    currentComments
  )
}

function mergeCommentListById(
  currentComments: WorkspaceReportComment[] = [],
  nextComments: WorkspaceReportComment[] = []
) {
  const commentsById = new Map(
    currentComments.map((comment) => [comment.id, comment])
  )

  for (const comment of nextComments) {
    commentsById.set(
      comment.id,
      commentsById.has(comment.id)
        ? mergeReportComment(commentsById.get(comment.id) as WorkspaceReportComment, comment)
        : comment
    )
  }

  return [...commentsById.values()]
}

function mergeReportComment(
  currentComment: WorkspaceReportComment,
  nextComment: WorkspaceReportComment
): WorkspaceReportComment {
  return {
    ...currentComment,
    ...nextComment,
    replies: mergeCommentListById(currentComment.replies, nextComment.replies),
    repliesPageInfo:
      nextComment.repliesPageInfo ?? currentComment.repliesPageInfo,
  }
}

function mergeRepliesIntoCommentTree({
  comments,
  pageInfo,
  parentCommentId,
  replies,
}: {
  comments: WorkspaceReportComment[]
  pageInfo: WorkspaceReportCommentsPageInfo
  parentCommentId: string
  replies: WorkspaceReportComment[]
}): WorkspaceReportComment[] {
  return comments.map((comment) => {
    if (comment.id === parentCommentId) {
      const mergedReplies = mergeCommentListById(comment.replies, replies)

      return {
        ...comment,
        replies: mergedReplies,
        repliesPageInfo: pageInfo,
        replyCount: Math.max(comment.replyCount, mergedReplies.length),
      }
    }

    return {
      ...comment,
      replies: mergeRepliesIntoCommentTree({
        comments: comment.replies,
        pageInfo,
        parentCommentId,
        replies,
      }),
    }
  })
}

function removeCommentFromTree(
  comments: WorkspaceReportComment[],
  commentId: string
): WorkspaceReportComment[] {
  return comments
    .filter((comment) => comment.id !== commentId)
    .map((comment) => ({
      ...comment,
      replies: removeCommentFromTree(comment.replies, commentId),
      replyCount: Math.max(
        0,
        comment.replyCount -
          (comment.replies.some((reply) => reply.id === commentId) ? 1 : 0)
      ),
    }))
}

function replaceCommentInTree(
  comments: WorkspaceReportComment[],
  optimisticCommentId: string,
  nextComment: WorkspaceReportComment
) {
  return addCommentToTree(
    removeCommentFromTree(comments, optimisticCommentId),
    nextComment
  )
}

function updateCommentInTree(
  comments: WorkspaceReportComment[],
  nextComment: WorkspaceReportComment
): WorkspaceReportComment[] {
  return comments.map((comment) => {
    if (comment.id === nextComment.id) {
      return mergeReportComment(comment, nextComment)
    }

    return {
      ...comment,
      replies: updateCommentInTree(comment.replies, nextComment),
    }
  })
}

function sortCommentReactions(
  reactions: WorkspaceReportComment["reactions"]
) {
  const order: WorkspaceReportCommentReactionKind[] = [
    "seen",
    "agree",
    "blocked",
    "helpful",
  ]

  return [...reactions].sort(
    (first, second) =>
      order.indexOf(first.reaction) - order.indexOf(second.reaction)
  )
}

function setCommentReaction(
  comment: WorkspaceReportComment,
  reaction: WorkspaceReportCommentReactionKind,
  enabled: boolean
): WorkspaceReportComment {
  const existingReaction = comment.reactions.find(
    (item) => item.reaction === reaction
  )
  const nextReactions = comment.reactions
    .map((item) => {
      if (item.reaction !== reaction) {
        return item
      }

      if (enabled) {
        return item.reactedByCurrentUser
          ? item
          : {
              ...item,
              count: item.count + 1,
              reactedByCurrentUser: true,
            }
      }

      return {
        ...item,
        count: item.reactedByCurrentUser ? item.count - 1 : item.count,
        reactedByCurrentUser: false,
      }
    })
    .filter((item) => item.count > 0)

  if (enabled && !existingReaction) {
    nextReactions.push({
      reaction,
      count: 1,
      reactedByCurrentUser: true,
    })
  }

  return {
    ...comment,
    reactions: sortCommentReactions(nextReactions),
  }
}

function setCommentReactionInTree(
  comments: WorkspaceReportComment[],
  commentId: string,
  reaction: WorkspaceReportCommentReactionKind,
  enabled: boolean
): WorkspaceReportComment[] {
  return comments.map((comment) => {
    if (comment.id === commentId) {
      return setCommentReaction(comment, reaction, enabled)
    }

    return {
      ...comment,
      replies: setCommentReactionInTree(
        comment.replies,
        commentId,
        reaction,
        enabled
      ),
    }
  })
}

function getScreenshotEvidenceScore(report: WorkspaceReport) {
  return report.screenshots.reduce((score, screenshot) => {
    const hasSource = Boolean(screenshot.url || screenshot.thumbnailUrl)
    return score + (hasSource ? 2 : 1)
  }, 0)
}

export function mergeReportCacheEntry(
  currentReport: WorkspaceReport,
  nextReport: WorkspaceReport
) {
  const currentEvidenceScore = getScreenshotEvidenceScore(currentReport)
  const nextEvidenceScore = getScreenshotEvidenceScore(nextReport)

  return {
    ...currentReport,
    ...nextReport,
    comments:
      nextReport.comments === undefined
        ? currentReport.comments
        : mergeCommentTrees(currentReport.comments, nextReport.comments),
    commentsPageInfo:
      nextReport.commentsPageInfo ?? currentReport.commentsPageInfo,
    screenshots:
      nextEvidenceScore >= currentEvidenceScore
        ? nextReport.screenshots
        : currentReport.screenshots,
  }
}

function isReportCacheEntry(value: unknown): value is WorkspaceReport {
  if (!value || typeof value !== "object" || !("id" in value)) {
    return false
  }

  return typeof value.id === "string"
}

function isReportDetailResponse(
  value: unknown
): value is WorkspaceReportDetailResponse {
  if (!value || typeof value !== "object" || !("report" in value)) {
    return false
  }

  return isReportCacheEntry(value.report)
}

function patchReportDetailCacheData<T>(data: T, nextReport: WorkspaceReport): T {
  if (!data || typeof data !== "object" || !("report" in data)) {
    return data
  }

  const currentReport = data.report

  if (!isReportCacheEntry(currentReport) || currentReport.id !== nextReport.id) {
    return data
  }

  return {
    ...data,
    report: mergeReportCacheEntry(currentReport, nextReport),
  } as T
}

function patchReportCollectionCacheData<T>(
  data: T,
  nextReport: WorkspaceReport
): T {
  if (!data || typeof data !== "object") {
    return data
  }

  if ("reports" in data && Array.isArray(data.reports)) {
    return {
      ...data,
      reports: patchReportList(data.reports, nextReport),
    } as T
  }

  if ("pages" in data && Array.isArray(data.pages)) {
    return {
      ...data,
      pages: data.pages.map((page) =>
        page && typeof page === "object" && "reports" in page
          ? {
              ...page,
              reports: Array.isArray(page.reports)
                ? patchReportList(page.reports, nextReport)
                : page.reports,
            }
          : page
      ),
    } as T
  }

  return data
}

function patchReportCacheData<T>(data: T, nextReport: WorkspaceReport): T {
  return patchReportCollectionCacheData(
    patchReportDetailCacheData(data, nextReport),
    nextReport
  )
}

export function syncReportAcrossCaches(
  queryClient: QueryClient,
  workspaceSlug: string,
  report: WorkspaceReport
) {
  queryClient.setQueriesData(
    { queryKey: reportKeys.all(workspaceSlug) },
    (currentData) => patchReportCacheData(currentData, report)
  )
}

function patchReportCommentsCacheData<T>(
  data: T,
  reportId: string,
  patcher: (report: WorkspaceReport) => WorkspaceReport
): T {
  if (!data || typeof data !== "object") {
    return data
  }

  if ("report" in data && isReportCacheEntry(data.report)) {
    if (data.report.id !== reportId) {
      return data
    }

    return {
      ...data,
      report: patcher(data.report),
    } as T
  }

  if ("reports" in data && Array.isArray(data.reports)) {
    return {
      ...data,
      reports: data.reports.map((report) =>
        isReportCacheEntry(report) && report.id === reportId
          ? patcher(report)
          : report
      ),
    } as T
  }

  if ("pages" in data && Array.isArray(data.pages)) {
    return {
      ...data,
      pages: data.pages.map((page) =>
        page && typeof page === "object" && "reports" in page
          ? {
              ...page,
              reports: Array.isArray(page.reports)
                ? page.reports.map((report: unknown) =>
                    isReportCacheEntry(report) && report.id === reportId
                      ? patcher(report)
                      : report
                  )
                : page.reports,
            }
          : page
      ),
    } as T
  }

  return data
}

function patchReportCommentsAcrossCaches({
  pageInfo,
  patcher,
  queryClient,
  reportId,
  workspaceSlug,
}: {
  pageInfo?: WorkspaceReportCommentsPageInfo
  patcher: (comments: WorkspaceReportComment[]) => WorkspaceReportComment[]
  queryClient: QueryClient
  reportId: string
  workspaceSlug: string
}) {
  queryClient.setQueriesData(
    { queryKey: reportKeys.all(workspaceSlug) },
    (currentData) =>
      patchReportCommentsCacheData(currentData, reportId, (report) => ({
        ...report,
        comments: patcher(report.comments ?? []),
        commentsPageInfo: pageInfo ?? report.commentsPageInfo,
      }))
  )
}

function setReportCommentsCountAcrossCaches({
  commentsCount,
  queryClient,
  reportId,
  workspaceSlug,
}: {
  commentsCount: number
  queryClient: QueryClient
  reportId: string
  workspaceSlug: string
}) {
  queryClient.setQueriesData(
    { queryKey: reportKeys.all(workspaceSlug) },
    (currentData) =>
      patchReportCommentsCacheData(currentData, reportId, (report) => ({
        ...report,
        commentsCount,
      }))
  )
}

function restoreReportSnapshots(
  queryClient: QueryClient,
  snapshots: CachedReportSnapshot | undefined
) {
  for (const [queryKey, data] of snapshots ?? []) {
    queryClient.setQueryData(queryKey, data)
  }
}

function getReportSnapshots(queryClient: QueryClient, workspaceSlug: string) {
  return queryClient.getQueriesData({
    queryKey: reportKeys.all(workspaceSlug),
  })
}

export function useReportsInfiniteQuery({
  filters,
  initialData,
  queryKind = "list",
  workspaceSlug,
}: {
  filters: ReportListFilters
  initialData?: InfiniteData<WorkspaceReportsListResponse, string | null>
  queryKind?: "list" | "my-work"
  workspaceSlug: string
}) {
  return useInfiniteQuery<
    WorkspaceReportsListResponse,
    Error,
    ReportsInfiniteData,
    ReportsListQueryKey,
    string | null
  >({
    getNextPageParam: (lastPage) => lastPage.pageInfo.nextCursor,
    initialData,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      fetchReportsList({
        cursor: pageParam,
        filters,
        workspaceSlug,
      }),
    queryKey:
      queryKind === "my-work"
        ? reportKeys.myWork(workspaceSlug, filters)
        : reportKeys.list(workspaceSlug, filters),
  })
}

export function useReportsFreshnessQuery({
  enabled = true,
  filters,
  workspaceSlug,
}: {
  enabled?: boolean
  filters: ReportListFilters
  workspaceSlug: string
}) {
  return useQuery({
    enabled,
    queryFn: () => fetchReportsList({ filters, workspaceSlug }),
    queryKey: reportKeys.freshness(workspaceSlug, filters),
    refetchInterval: refetchVisibleReportsIntervalMs,
    refetchIntervalInBackground: false,
    staleTime: 0,
  })
}

export function useReportCountsQuery({
  filters = {},
  workspaceSlug,
}: {
  filters?: ReportCountFilters
  workspaceSlug: string
}) {
  return useQuery({
    queryFn: () => fetchReportCounts({ filters, workspaceSlug }),
    queryKey: reportKeys.counts(workspaceSlug, filters),
    staleTime: 30 * 1000,
  })
}

export function useReportDetailQuery({
  enabled = true,
  placeholderReport,
  reportId,
  workspaceSlug,
}: {
  enabled?: boolean
  placeholderReport?: WorkspaceReport
  reportId?: string | null
  workspaceSlug: string
}) {
  const queryClient = useQueryClient()
  const query = useQuery({
    enabled: enabled && Boolean(reportId),
    placeholderData: placeholderReport ? { report: placeholderReport } : undefined,
    queryFn: () => fetchReportDetail(workspaceSlug, reportId ?? ""),
    queryKey: reportId
      ? reportKeys.detail(workspaceSlug, reportId)
      : reportKeys.detail(workspaceSlug, "__none__"),
    refetchOnMount: "always",
    staleTime: 45 * 1000,
    structuralSharing: (oldData, newData) => {
      if (
        !isReportDetailResponse(oldData) ||
        !isReportDetailResponse(newData)
      ) {
        return newData
      }

      return {
        ...newData,
        report: mergeReportCacheEntry(oldData.report, newData.report),
      }
    },
  })

  useEffect(() => {
    if (query.isPlaceholderData || !query.data?.report) {
      return
    }

    syncReportAcrossCaches(queryClient, workspaceSlug, query.data.report)
  }, [query.data, query.isPlaceholderData, queryClient, workspaceSlug])

  return query
}

export function usePrefetchReportDetail(workspaceSlug: string) {
  const queryClient = useQueryClient()

  return useCallback(
    (reportId: string) => {
      const queryKey = reportKeys.detail(workspaceSlug, reportId)

      void queryClient
        .prefetchQuery({
          queryFn: () => fetchReportDetail(workspaceSlug, reportId),
          queryKey,
          staleTime: 45 * 1000,
        })
        .then(() => {
          const detail =
            queryClient.getQueryData<WorkspaceReportDetailResponse>(queryKey)

          if (detail?.report) {
            syncReportAcrossCaches(queryClient, workspaceSlug, detail.report)
          }
        })
        .catch(() => {
          // Hover/focus prefetch is opportunistic; visible queries own errors.
        })
    },
    [queryClient, workspaceSlug]
  )
}

export function useAssignReportMutation(workspaceSlug: string) {
  const queryClient = useQueryClient()

  return useMutation<
    ReportMutationResponse,
    Error,
    AssignReportVariables,
    ReportMutationContext
  >({
    mutationFn: ({ assigneeUserId, report }) =>
      patchJson<ReportMutationResponse>(
        `${getReportMutationBaseUrl(workspaceSlug, report.id)}/assignment`,
        { assigneeUserId }
      ),
    onError: (_error, _variables, context) => {
      restoreReportSnapshots(queryClient, context?.snapshots)
    },
    onMutate: async ({ assignee, assigneeUserId, report }) => {
      await queryClient.cancelQueries({ queryKey: reportKeys.all(workspaceSlug) })

      const snapshots = getReportSnapshots(queryClient, workspaceSlug)
      const optimisticReport: WorkspaceReport = {
        ...report,
        assignee,
        assigneeUserId,
        status: assigneeUserId
          ? "assigned"
          : optimisticUnassignResetStatuses.includes(report.status)
            ? "reviewing"
            : report.status,
      }

      syncReportAcrossCaches(queryClient, workspaceSlug, optimisticReport)

      return { snapshots }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: reportKeys.countsRoot(workspaceSlug),
      })
    },
    onSuccess: (result) => {
      syncReportAcrossCaches(queryClient, workspaceSlug, result.report)
    },
  })
}

export function useUpdateReportStatusMutation(workspaceSlug: string) {
  const queryClient = useQueryClient()

  return useMutation<
    ReportMutationResponse,
    Error,
    UpdateReportStatusVariables,
    ReportMutationContext
  >({
    mutationFn: ({ report, status }) =>
      patchJson<ReportMutationResponse>(
        `${getReportMutationBaseUrl(workspaceSlug, report.id)}/status`,
        { status }
      ),
    onError: (_error, _variables, context) => {
      restoreReportSnapshots(queryClient, context?.snapshots)
    },
    onMutate: async ({ report, status }) => {
      await queryClient.cancelQueries({ queryKey: reportKeys.all(workspaceSlug) })

      const snapshots = getReportSnapshots(queryClient, workspaceSlug)
      const optimisticReport: WorkspaceReport = {
        ...report,
        status,
      }

      syncReportAcrossCaches(queryClient, workspaceSlug, optimisticReport)

      return { snapshots }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: reportKeys.countsRoot(workspaceSlug),
      })
    },
    onSuccess: (result) => {
      syncReportAcrossCaches(queryClient, workspaceSlug, result.report)
    },
  })
}

export function useUpdateReportImplementationBriefMutation(workspaceSlug: string) {
  const queryClient = useQueryClient()

  return useMutation<
    ReportMutationResponse,
    Error,
    UpdateReportImplementationBriefVariables,
    ReportMutationContext
  >({
    mutationFn: ({ implementationBrief, report }) =>
      patchJson<ReportMutationResponse>(
        `${getReportMutationBaseUrl(workspaceSlug, report.id)}/implementation-brief`,
        implementationBrief
      ),
    onError: (_error, _variables, context) => {
      restoreReportSnapshots(queryClient, context?.snapshots)
    },
    onMutate: async ({ implementationBrief, report }) => {
      await queryClient.cancelQueries({ queryKey: reportKeys.all(workspaceSlug) })

      const snapshots = getReportSnapshots(queryClient, workspaceSlug)
      const optimisticReport: WorkspaceReport = {
        ...report,
        implementationBrief,
      }

      syncReportAcrossCaches(queryClient, workspaceSlug, optimisticReport)

      return { snapshots }
    },
    onSuccess: (result) => {
      syncReportAcrossCaches(queryClient, workspaceSlug, result.report)
    },
  })
}

export function useCreateReportNoteMutation(workspaceSlug: string) {
  const queryClient = useQueryClient()

  return useMutation<
    ReportMutationResponse,
    Error,
    CreateReportNoteVariables,
    ReportMutationContext
  >({
    mutationFn: ({ body, kind, report }) =>
      postJson<ReportMutationResponse>(
        `${getReportMutationBaseUrl(workspaceSlug, report.id)}/notes`,
        { body, kind }
      ),
    onError: (_error, _variables, context) => {
      restoreReportSnapshots(queryClient, context?.snapshots)
    },
    onMutate: async ({ optimisticActivityItem, report }) => {
      await queryClient.cancelQueries({ queryKey: reportKeys.all(workspaceSlug) })

      const snapshots = getReportSnapshots(queryClient, workspaceSlug)
      const optimisticReport: WorkspaceReport = {
        ...report,
        activity: [optimisticActivityItem, ...(report.activity ?? [])],
      }

      syncReportAcrossCaches(queryClient, workspaceSlug, optimisticReport)

      return { snapshots }
    },
    onSuccess: (result) => {
      syncReportAcrossCaches(queryClient, workspaceSlug, result.report)
    },
  })
}

export function useCreateReportCommentMutation(workspaceSlug: string) {
  const queryClient = useQueryClient()

  return useMutation<
    WorkspaceReportCommentMutationResponse,
    Error,
    CreateReportCommentVariables,
    ReportMutationContext
  >({
    mutationFn: ({ body, parentCommentId, report }) =>
      postJson<WorkspaceReportCommentMutationResponse>(
        `${getReportMutationBaseUrl(workspaceSlug, report.id)}/comments`,
        { body, parentCommentId: parentCommentId ?? null }
      ),
    onError: (_error, _variables, context) => {
      restoreReportSnapshots(queryClient, context?.snapshots)
    },
    onMutate: async ({ onOptimisticCommit, optimisticComment, report }) => {
      await queryClient.cancelQueries({ queryKey: reportKeys.all(workspaceSlug) })

      const snapshots = getReportSnapshots(queryClient, workspaceSlug)
      const optimisticReport: WorkspaceReport = {
        ...report,
        comments: addCommentToTree(report.comments ?? [], optimisticComment),
        commentsCount: report.commentsCount + 1,
      }

      syncReportAcrossCaches(queryClient, workspaceSlug, optimisticReport)
      onOptimisticCommit?.()

      return { snapshots }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: reportKeys.countsRoot(workspaceSlug),
      })
    },
    onSuccess: (result, variables) => {
      const commentsCount = Math.max(
        result.report.commentsCount,
        variables.report.commentsCount + 1
      )

      patchReportCommentsAcrossCaches({
        queryClient,
        reportId: variables.report.id,
        workspaceSlug,
        patcher: (comments) =>
          replaceCommentInTree(
            comments,
            variables.optimisticComment.id,
            result.comment
          ),
      })
      setReportCommentsCountAcrossCaches({
        commentsCount,
        queryClient,
        reportId: variables.report.id,
        workspaceSlug,
      })
    },
  })
}

export function useUpdateReportCommentMutation(workspaceSlug: string) {
  const queryClient = useQueryClient()

  return useMutation<
    WorkspaceReportCommentMutationResponse,
    Error,
    UpdateReportCommentVariables,
    ReportMutationContext
  >({
    mutationFn: ({ body, comment, report }) =>
      patchJson<WorkspaceReportCommentMutationResponse>(
        getReportCommentMutationUrl({
          commentId: comment.id,
          reportId: report.id,
          workspaceSlug,
        }),
        { body }
      ),
    onError: (_error, _variables, context) => {
      restoreReportSnapshots(queryClient, context?.snapshots)
    },
    onMutate: async ({ optimisticComment, report }) => {
      await queryClient.cancelQueries({ queryKey: reportKeys.all(workspaceSlug) })

      const snapshots = getReportSnapshots(queryClient, workspaceSlug)
      const optimisticReport: WorkspaceReport = {
        ...report,
        comments: updateCommentInTree(report.comments ?? [], optimisticComment),
      }

      syncReportAcrossCaches(queryClient, workspaceSlug, optimisticReport)

      return { snapshots }
    },
    onSuccess: (result) => {
      syncReportAcrossCaches(queryClient, workspaceSlug, result.report)
      patchReportCommentsAcrossCaches({
        queryClient,
        reportId: result.report.id,
        workspaceSlug,
        patcher: (comments) => updateCommentInTree(comments, result.comment),
      })
    },
  })
}

export function useDeleteReportCommentMutation(workspaceSlug: string) {
  const queryClient = useQueryClient()

  return useMutation<
    WorkspaceReportCommentDeleteResponse,
    Error,
    DeleteReportCommentVariables,
    ReportMutationContext
  >({
    mutationFn: ({ comment, report }) =>
      deleteJson<WorkspaceReportCommentDeleteResponse>(
        getReportCommentMutationUrl({
          commentId: comment.id,
          reportId: report.id,
          workspaceSlug,
        })
      ),
    onError: (_error, _variables, context) => {
      restoreReportSnapshots(queryClient, context?.snapshots)
    },
    onMutate: async ({ comment, optimisticComment, report }) => {
      await queryClient.cancelQueries({ queryKey: reportKeys.all(workspaceSlug) })

      const snapshots = getReportSnapshots(queryClient, workspaceSlug)
      const nextComments =
        comment.replyCount > 0
          ? updateCommentInTree(report.comments ?? [], optimisticComment)
          : removeCommentFromTree(report.comments ?? [], comment.id)
      const optimisticReport: WorkspaceReport = {
        ...report,
        comments: nextComments,
        commentsCount: Math.max(0, report.commentsCount - 1),
      }

      syncReportAcrossCaches(queryClient, workspaceSlug, optimisticReport)

      return { snapshots }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: reportKeys.countsRoot(workspaceSlug),
      })
    },
    onSuccess: (result) => {
      syncReportAcrossCaches(queryClient, workspaceSlug, result.report)
      patchReportCommentsAcrossCaches({
        queryClient,
        reportId: result.report.id,
        workspaceSlug,
        patcher: (comments) =>
          result.removed
            ? removeCommentFromTree(comments, result.comment.id)
            : updateCommentInTree(comments, result.comment),
      })
      setReportCommentsCountAcrossCaches({
        commentsCount: result.report.commentsCount,
        queryClient,
        reportId: result.report.id,
        workspaceSlug,
      })
    },
  })
}

export function useUpdateReportCommentReactionMutation(workspaceSlug: string) {
  const queryClient = useQueryClient()

  return useMutation<
    WorkspaceReportCommentMutationResponse,
    Error,
    UpdateReportCommentReactionVariables,
    ReportMutationContext
  >({
    mutationFn: ({ comment, enabled, reaction, report }) =>
      putJson<WorkspaceReportCommentMutationResponse>(
        `${getReportCommentMutationUrl({
          commentId: comment.id,
          reportId: report.id,
          workspaceSlug,
        })}/reactions`,
        { enabled, reaction }
      ),
    onError: (_error, _variables, context) => {
      restoreReportSnapshots(queryClient, context?.snapshots)
    },
    onMutate: async ({ enabled, reaction, report, comment }) => {
      await queryClient.cancelQueries({ queryKey: reportKeys.all(workspaceSlug) })

      const snapshots = getReportSnapshots(queryClient, workspaceSlug)
      const optimisticReport: WorkspaceReport = {
        ...report,
        comments: setCommentReactionInTree(
          report.comments ?? [],
          comment.id,
          reaction,
          enabled
        ),
      }

      syncReportAcrossCaches(queryClient, workspaceSlug, optimisticReport)

      return { snapshots }
    },
    onSuccess: (result) => {
      syncReportAcrossCaches(queryClient, workspaceSlug, result.report)
      patchReportCommentsAcrossCaches({
        queryClient,
        reportId: result.report.id,
        workspaceSlug,
        patcher: (comments) => updateCommentInTree(comments, result.comment),
      })
    },
  })
}

export function useLoadReportCommentsMutation(workspaceSlug: string) {
  const queryClient = useQueryClient()

  return useMutation<
    WorkspaceReportCommentsResponse,
    Error,
    LoadReportCommentsVariables
  >({
    mutationFn: ({ cursor, limit, parentCommentId, report }) =>
      fetchReportComments({
        cursor,
        limit,
        parentCommentId,
        reportId: report.id,
        workspaceSlug,
      }),
    onSuccess: (result, variables) => {
      if (variables.parentCommentId) {
        patchReportCommentsAcrossCaches({
          queryClient,
          reportId: variables.report.id,
          workspaceSlug,
          patcher: (comments) =>
            mergeRepliesIntoCommentTree({
              comments,
              pageInfo: result.pageInfo,
              parentCommentId: variables.parentCommentId as string,
              replies: result.comments,
            }),
        })

        return
      }

      patchReportCommentsAcrossCaches({
        pageInfo: result.pageInfo,
        queryClient,
        reportId: variables.report.id,
        workspaceSlug,
        patcher: (comments) => mergeCommentTrees(comments, result.comments),
      })
    },
  })
}
