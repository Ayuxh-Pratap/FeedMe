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

import { deleteJson, getJson, patchJson, postJson } from "@/lib/api-client"
import {
  reportKeys,
  workspaceKeys,
  type ReportCountFilters,
  type ReportListFilters,
} from "@/lib/query-keys"
import type {
  WorkspaceReport,
  WorkspaceReportActivityItem,
  WorkspaceReportComment,
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
  notificationDelivery?: "delivered" | "failed" | "not_required"
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
  mentionedUserIds?: string[]
  onOptimisticCommit?: () => void
  optimisticComment: WorkspaceReportComment
  parentCommentId?: string | null
  report: WorkspaceReport
}

type UpdateReportCommentVariables = {
  body: string
  comment: WorkspaceReportComment
  mentionedUserIds?: string[]
  optimisticComment: WorkspaceReportComment
  report: WorkspaceReport
}

type DeleteReportCommentVariables = {
  comment: WorkspaceReportComment
  optimisticComment: WorkspaceReportComment
  report: WorkspaceReport
}

type LoadReportCommentsVariables = {
  cursor?: string | null
  limit?: number
  parentCommentId?: string | null
  report: WorkspaceReport
  targetCommentId?: string | null
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
  targetCommentId,
  workspaceSlug,
}: {
  cursor?: string | null
  limit?: number
  parentCommentId?: string | null
  reportId: string
  targetCommentId?: string | null
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

  if (targetCommentId) {
    searchParams.set("targetCommentId", targetCommentId)
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
  targetCommentId,
  workspaceSlug,
}: {
  cursor?: string | null
  limit?: number
  parentCommentId?: string | null
  reportId: string
  targetCommentId?: string | null
  workspaceSlug: string
}) {
  return getJson<WorkspaceReportCommentsResponse>(
    getReportCommentsUrl({
      cursor,
      limit,
      parentCommentId,
      reportId,
      targetCommentId,
      workspaceSlug,
    })
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
  let didUpdate = false
  const nextReports = reports.map((report) => {
    if (report.id !== nextReport.id) {
      return report
    }

    didUpdate = true
    return mergeReportCacheEntry(report, nextReport)
  })

  return didUpdate ? nextReports : reports
}

function isOptimisticReportComment(comment: WorkspaceReportComment) {
  return comment.id.startsWith("optimistic-")
}

function normalizeCommentIdentityBody(body: string) {
  return body.trim()
}

function isMatchingOptimisticComment(
  currentComment: WorkspaceReportComment,
  nextComment: WorkspaceReportComment
) {
  if (
    !isOptimisticReportComment(currentComment) ||
    isOptimisticReportComment(nextComment)
  ) {
    return false
  }

  const currentAuthorId = currentComment.author?.id
  const nextAuthorId = nextComment.author?.id
  const currentAuthorEmail = currentComment.author?.email
  const nextAuthorEmail = nextComment.author?.email
  const hasSameAuthor =
    currentAuthorId && nextAuthorId
      ? currentAuthorId === nextAuthorId
      : currentAuthorEmail && nextAuthorEmail
        ? currentAuthorEmail === nextAuthorEmail
        : false

  return (
    hasSameAuthor &&
    (currentComment.parentCommentId ?? null) ===
      (nextComment.parentCommentId ?? null) &&
    normalizeCommentIdentityBody(currentComment.body) ===
      normalizeCommentIdentityBody(nextComment.body)
  )
}

function removeFirstMatchingOptimisticComment(
  comments: WorkspaceReportComment[],
  nextComment: WorkspaceReportComment
): {
  comments: WorkspaceReportComment[]
  removedParentCommentId: string | null
} {
  if (isOptimisticReportComment(nextComment)) {
    return {
      comments,
      removedParentCommentId: null,
    }
  }

  for (let index = 0; index < comments.length; index += 1) {
    const comment = comments[index]

    if (isMatchingOptimisticComment(comment, nextComment)) {
      return {
        comments: [
          ...comments.slice(0, index),
          ...comments.slice(index + 1),
        ],
        removedParentCommentId: comment.parentCommentId ?? null,
      }
    }

    const nestedResult = removeFirstMatchingOptimisticComment(
      comment.replies,
      nextComment
    )

    if (nestedResult.removedParentCommentId !== null) {
      const removedDirectReply = nestedResult.removedParentCommentId === comment.id
      const nextComments = [...comments]

      nextComments[index] = {
        ...comment,
        replies: nestedResult.comments,
        replyCount: removedDirectReply
          ? Math.max(nestedResult.comments.length, comment.replyCount - 1)
          : comment.replyCount,
      }

      return {
        comments: nextComments,
        removedParentCommentId: nestedResult.removedParentCommentId,
      }
    }
  }

  return {
    comments,
    removedParentCommentId: null,
  }
}

function addCommentToTree(
  comments: WorkspaceReportComment[],
  nextComment: WorkspaceReportComment
): WorkspaceReportComment[] {
  const normalizedComments = removeFirstMatchingOptimisticComment(
    comments,
    nextComment
  ).comments

  if (normalizedComments.some((comment) => comment.id === nextComment.id)) {
    return normalizedComments.map((comment) =>
      comment.id === nextComment.id
        ? mergeReportComment(comment, nextComment)
        : comment
    )
  }

  if (!nextComment.parentCommentId) {
    return [...normalizedComments, nextComment]
  }

  return normalizedComments.map((comment) => {
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

// Comments the client has deleted, mapped to the deleted placeholder to render
// (or null when the comment should be removed entirely). A stale in-flight detail
// fetch (e.g. the refetchOnMount fetch on a fresh landing) can carry a comment
// captured before its deletion; because comment tree merges are additive, that
// would resurrect it. Applying these deletions to every incoming detail tree makes
// the delete survive any such fetch, regardless of timing or contents.
const pendingCommentDeletions = new Map<string, WorkspaceReportComment | null>()

export function markCommentDeleted(
  commentId: string,
  placeholder: WorkspaceReportComment | null
) {
  pendingCommentDeletions.set(commentId, placeholder)
}

export function unmarkCommentDeleted(commentId: string) {
  pendingCommentDeletions.delete(commentId)
}

export function applyPendingCommentDeletions(
  comments: WorkspaceReportComment[]
): WorkspaceReportComment[] {
  if (pendingCommentDeletions.size === 0) {
    return comments
  }

  const result: WorkspaceReportComment[] = []

  for (const comment of comments) {
    const replies = applyPendingCommentDeletions(comment.replies)

    if (pendingCommentDeletions.has(comment.id)) {
      const placeholder = pendingCommentDeletions.get(comment.id) ?? null

      // null -> the comment was removed (no replies); drop it.
      // placeholder -> keep it, but force the deleted state so a stale fetch that
      // still carries the normal version cannot un-delete it. Keep current replies.
      if (placeholder) {
        result.push({ ...placeholder, replies })
      }

      continue
    }

    if (replies === comment.replies) {
      result.push(comment)
      continue
    }

    result.push({
      ...comment,
      replies,
      replyCount: Math.max(0, comment.replyCount - (comment.replies.length - replies.length)),
    })
  }

  return result
}

function mergeCommentListById(
  currentComments: WorkspaceReportComment[] = [],
  nextComments: WorkspaceReportComment[] = []
) {
  let mergedComments = currentComments

  for (const comment of nextComments) {
    const normalizedComments = removeFirstMatchingOptimisticComment(
      mergedComments,
      comment
    ).comments
    const commentIndex = normalizedComments.findIndex(
      (currentComment) => currentComment.id === comment.id
    )

    if (commentIndex === -1) {
      mergedComments = [...normalizedComments, comment]
      continue
    }

    mergedComments = normalizedComments.map((currentComment, index) =>
      index === commentIndex
        ? mergeReportComment(currentComment, comment)
        : currentComment
    )
  }

  return mergedComments
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

function applyDeletedCommentToTree(
  comments: WorkspaceReportComment[],
  deletedComment: WorkspaceReportComment,
  removed: boolean
) {
  return removed
    ? removeCommentFromTree(comments, deletedComment.id)
    : updateCommentInTree(comments, deletedComment)
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
    const nextReports = patchReportList(data.reports, nextReport)

    if (nextReports === data.reports) {
      return data
    }

    return {
      ...data,
      reports: nextReports,
    } as T
  }

  if ("pages" in data && Array.isArray(data.pages)) {
    let didUpdate = false
    const nextPages = data.pages.map((page) => {
      if (!page || typeof page !== "object" || !("reports" in page)) {
        return page
      }

      if (!Array.isArray(page.reports)) {
        return page
      }

      const nextReports = patchReportList(page.reports, nextReport)

      if (nextReports === page.reports) {
        return page
      }

      didUpdate = true
      return {
        ...page,
        reports: nextReports,
      }
    })

    if (!didUpdate) {
      return data
    }

    return {
      ...data,
      pages: nextPages,
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

export function syncReportCollectionCaches(
  queryClient: QueryClient,
  workspaceSlug: string,
  report: WorkspaceReport
) {
  queryClient.setQueriesData(
    { queryKey: reportKeys.all(workspaceSlug) },
    (currentData) => patchReportCollectionCacheData(currentData, report)
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
  baseReport,
  pageInfo,
  patcher,
  queryClient,
  reportId,
  workspaceSlug,
}: {
  baseReport?: WorkspaceReport
  pageInfo?: WorkspaceReportCommentsPageInfo
  patcher: (comments: WorkspaceReportComment[]) => WorkspaceReportComment[]
  queryClient: QueryClient
  reportId: string
  workspaceSlug: string
}) {
  // Every cache write runs through here, so this is the single choke point that
  // enforces client-side deletions: whatever a patcher produces (including merged
  // pagination pages that predate a delete), a registered-deleted comment can never
  // survive into a rendered tree. The fetch path enforces the same in structuralSharing.
  queryClient.setQueriesData(
    { queryKey: reportKeys.all(workspaceSlug) },
    (currentData) =>
      patchReportCommentsCacheData(currentData, reportId, (report) => ({
        ...report,
        comments: applyPendingCommentDeletions(patcher(report.comments ?? [])),
        commentsPageInfo: pageInfo ?? report.commentsPageInfo,
      }))
  )

  if (baseReport?.id === reportId) {
    queryClient.setQueryData<WorkspaceReportDetailResponse>(
      reportKeys.detail(workspaceSlug, reportId),
      (currentData) => {
        const currentReport =
          isReportDetailResponse(currentData) && currentData.report.id === reportId
            ? currentData.report
            : baseReport

        return {
          report: {
            ...currentReport,
            comments: applyPendingCommentDeletions(patcher(currentReport.comments ?? [])),
            commentsPageInfo: pageInfo ?? currentReport.commentsPageInfo,
          },
        }
      }
    )
  }
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

function invalidateWorkspaceNotifications(
  queryClient: QueryClient,
  workspaceSlug: string
) {
  void queryClient.invalidateQueries({
    queryKey: workspaceKeys.notifications(workspaceSlug),
  })
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
      if (!isReportDetailResponse(newData)) {
        return newData
      }

      // Merge to preserve loaded replies/pages, then apply client-side deletions so
      // a stale in-flight fetch can never resurrect (or un-delete) a removed comment.
      const report = isReportDetailResponse(oldData)
        ? mergeReportCacheEntry(oldData.report, newData.report)
        : newData.report

      return {
        ...newData,
        report: {
          ...report,
          comments: report.comments
            ? applyPendingCommentDeletions(report.comments)
            : report.comments,
        },
      }
    },
  })

  useEffect(() => {
    if (query.isPlaceholderData || !query.data?.report) {
      return
    }

    syncReportCollectionCaches(queryClient, workspaceSlug, query.data.report)
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
            syncReportCollectionCaches(queryClient, workspaceSlug, detail.report)
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
      invalidateWorkspaceNotifications(queryClient, workspaceSlug)
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
      invalidateWorkspaceNotifications(queryClient, workspaceSlug)
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
    onSettled: () => {
      invalidateWorkspaceNotifications(queryClient, workspaceSlug)
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
    mutationFn: ({ body, mentionedUserIds, parentCommentId, report }) =>
      postJson<WorkspaceReportCommentMutationResponse>(
        `${getReportMutationBaseUrl(workspaceSlug, report.id)}/comments`,
        {
          body,
          mentionedUserIds: mentionedUserIds ?? [],
          parentCommentId: parentCommentId ?? null,
        }
      ),
    onError: (_error, _variables, context) => {
      restoreReportSnapshots(queryClient, context?.snapshots)
    },
    onMutate: async ({ onOptimisticCommit, optimisticComment, report }) => {
      await queryClient.cancelQueries({ queryKey: reportKeys.all(workspaceSlug) })

      const snapshots = getReportSnapshots(queryClient, workspaceSlug)
      const optimisticCommentsCount = report.commentsCount + 1

      patchReportCommentsAcrossCaches({
        baseReport: report,
        queryClient,
        reportId: report.id,
        workspaceSlug,
        patcher: (comments) => addCommentToTree(comments, optimisticComment),
      })
      setReportCommentsCountAcrossCaches({
        commentsCount: optimisticCommentsCount,
        queryClient,
        reportId: report.id,
        workspaceSlug,
      })
      onOptimisticCommit?.()

      return { snapshots }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: reportKeys.countsRoot(workspaceSlug),
      })
      invalidateWorkspaceNotifications(queryClient, workspaceSlug)
    },
    onSuccess: (result, variables) => {
      patchReportCommentsAcrossCaches({
        baseReport: variables.report,
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
        commentsCount: result.report.commentsCount,
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
    mutationFn: ({ body, comment, mentionedUserIds, report }) =>
      patchJson<WorkspaceReportCommentMutationResponse>(
        getReportCommentMutationUrl({
          commentId: comment.id,
          reportId: report.id,
          workspaceSlug,
        }),
        { body, mentionedUserIds }
      ),
    onError: (_error, _variables, context) => {
      restoreReportSnapshots(queryClient, context?.snapshots)
    },
    onMutate: async ({ optimisticComment, report }) => {
      await queryClient.cancelQueries({ queryKey: reportKeys.all(workspaceSlug) })

      const snapshots = getReportSnapshots(queryClient, workspaceSlug)

      patchReportCommentsAcrossCaches({
        baseReport: report,
        queryClient,
        reportId: report.id,
        workspaceSlug,
        patcher: (comments) => updateCommentInTree(comments, optimisticComment),
      })

      return { snapshots }
    },
    onSettled: () => {
      invalidateWorkspaceNotifications(queryClient, workspaceSlug)
    },
    onSuccess: (result, variables) => {
      patchReportCommentsAcrossCaches({
        baseReport: variables.report,
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
    onError: (_error, variables, context) => {
      // The delete failed; allow the comment to reappear.
      unmarkCommentDeleted(variables.comment.id)
      restoreReportSnapshots(queryClient, context?.snapshots)
    },
    onMutate: async ({ comment, optimisticComment, report }) => {
      await queryClient.cancelQueries({ queryKey: reportKeys.all(workspaceSlug) })

      const snapshots = getReportSnapshots(queryClient, workspaceSlug)
      const optimisticRemoved = comment.replyCount === 0
      const optimisticCommentsCount = Math.max(0, report.commentsCount - 1)

      // Register the deletion so any stale in-flight fetch that still carries this
      // comment is reconciled (dropped when removed, forced deleted when it has replies).
      markCommentDeleted(comment.id, optimisticRemoved ? null : optimisticComment)

      patchReportCommentsAcrossCaches({
        baseReport: report,
        queryClient,
        reportId: report.id,
        workspaceSlug,
        patcher: (comments) =>
          applyDeletedCommentToTree(comments, optimisticComment, optimisticRemoved),
      })
      setReportCommentsCountAcrossCaches({
        commentsCount: optimisticCommentsCount,
        queryClient,
        reportId: report.id,
        workspaceSlug,
      })

      return { snapshots }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: reportKeys.countsRoot(workspaceSlug),
      })
      invalidateWorkspaceNotifications(queryClient, workspaceSlug)
    },
    onSuccess: (result, variables) => {
      // Reconcile the registry with the server's authoritative answer: dropped when
      // fully removed, kept as the server's deleted placeholder when it still has replies.
      markCommentDeleted(result.comment.id, result.removed ? null : result.comment)

      patchReportCommentsAcrossCaches({
        baseReport: variables.report,
        queryClient,
        reportId: result.report.id,
        workspaceSlug,
        patcher: (comments) =>
          applyDeletedCommentToTree(comments, result.comment, result.removed),
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

export function useLoadReportCommentsMutation(workspaceSlug: string) {
  const queryClient = useQueryClient()

  return useMutation<
    WorkspaceReportCommentsResponse,
    Error,
    LoadReportCommentsVariables
  >({
    mutationFn: ({ cursor, limit, parentCommentId, report, targetCommentId }) =>
      fetchReportComments({
        cursor,
        limit,
        parentCommentId,
        reportId: report.id,
        targetCommentId,
        workspaceSlug,
      }),
    onSuccess: (result, variables) => {
      if (variables.targetCommentId) {
        patchReportCommentsAcrossCaches({
          baseReport: variables.report,
          queryClient,
          reportId: variables.report.id,
          workspaceSlug,
          patcher: (comments) => mergeCommentTrees(comments, result.comments),
        })

        return
      }

      if (variables.parentCommentId) {
        patchReportCommentsAcrossCaches({
          baseReport: variables.report,
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
        baseReport: variables.report,
        pageInfo: result.pageInfo,
        queryClient,
        reportId: variables.report.id,
        workspaceSlug,
        patcher: (comments) => mergeCommentTrees(comments, result.comments),
      })
    },
  })
}
