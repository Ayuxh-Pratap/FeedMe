import { createHash, randomUUID } from "node:crypto"

import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  or,
  sql,
  type SQL,
} from "drizzle-orm"

import { db } from "@/db"
import {
  reportAssets,
  reportCommentMentions,
  reportCommentReactions,
  reportComments,
  reportImplementationBriefs,
  reportNotes,
  notificationOutbox,
  reportStatusEvents,
  reports,
  userProfiles,
  users,
  workspaceDomains,
  workspaceMemberships,
  type ReportSelectedElement,
  type ReportViewport,
} from "@/db/schema"
import { buildCloudinaryThumbnailUrl } from "@/lib/cloudinary"
import {
  canAssignedMemberCreateNote,
  canAssignedMemberTransition,
} from "@/lib/report-workflow"
import {
  activeReportStatuses,
  formatReportCapturedAgo,
  formatReportCapturedAt,
  isWorkspaceReportAssignmentLocked,
  progressReportStatuses,
  type WorkspaceReport,
  type WorkspaceReportActivityActor,
  type WorkspaceReportActivityItem,
  type WorkspaceReportComment,
  type WorkspaceReportCommentReactionKind,
  type WorkspaceReportCommentReactionSummary,
  type WorkspaceReportCommentsPageInfo,
  type WorkspaceReportImplementationBrief,
  type WorkspaceReportNoteKind,
  type WorkspaceReportSort,
  type WorkspaceReportStatus,
  type WorkspaceReportsPageInfo,
} from "@/lib/reports"
import {
  assignableReportRoles,
  getInitialsFromName,
  getNameFromEmail,
  isAssignableReportRole,
  type WorkspaceMemberRole,
} from "@/lib/team-members"
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/server/http/errors"
import {
  buildNotificationOutboxValues,
  getActiveWorkspaceUserIdsByRoles,
  processNotificationOutboxEvent,
  type DurableWorkspaceNotificationInput,
} from "@/server/notifications/service"
import { assertCanWorkspaceRole } from "@/server/policies/can"
import { normalizeDomainHost } from "@/server/workspaces/domains"
import { getWorkspaceForUserBySlug } from "@/server/workspaces/service"
import type {
  AssignReportInput,
  BulkCreateTasksInput,
  CreateReportCommentInput,
  CreateReportInput,
  CreateReportNoteInput,
  ListReportCommentsInput,
  ListReportsInput,
  ReportCountsInput,
  UpdateReportCommentInput,
  UpdateReportCommentReactionInput,
  UpdateReportImplementationBriefInput,
  UpdateReportStatusInput,
} from "@/server/reports/validation"

type ReportRow = {
  id: string
  title: string
  summary: string
  severity: WorkspaceReport["severity"]
  status: WorkspaceReport["status"]
  type: WorkspaceReport["type"]
  source: WorkspaceReport["source"]
  domain: string | null
  url: string | null
  browser: string | null
  device: string | null
  viewport: ReportViewport | null
  selectedElement: ReportSelectedElement | null
  feedbackMessage: string
  developerPrompt: string | null
  reporterUserId: string | null
  assigneeUserId: string | null
  capturedAt: Date
  commentsCount: number
}

type ReportPerson = {
  id: string
  email: string
  fullName: string | null
  displayName: string | null
  avatarUrl: string | null
}

type ReportAssetRow = {
  id: string
  reportId: string
  type: "page_screenshot" | "element_screenshot" | "annotated_screenshot"
  url: string
  width: number | null
  height: number | null
}

type ReportImplementationBriefRow = {
  acceptanceCriteria: string[]
  implementationNotes: string | null
  constraintsNonGoals: string[]
  expectedBehavior: string | null
  referenceLinks: WorkspaceReportImplementationBrief["referenceLinks"]
  reviewChecklist: string[]
  updatedAt: Date
  updatedByUserId: string | null
}

type ReportCommentRow = {
  id: string
  parentCommentId: string | null
  authorUserId: string | null
  body: string
  createdAt: Date
  editedAt: Date | null
  deletedAt: Date | null
  mentions: WorkspaceReportActivityActor[]
  reactions: WorkspaceReportCommentReactionSummary[]
  replyCount: number
}

type ReportNoteRow = {
  id: string
  authorUserId: string | null
  kind: WorkspaceReportNoteKind
  body: string
  createdAt: Date
}

type ReportStatusEventRow = {
  id: string
  actorUserId: string | null
  fromStatus: WorkspaceReportStatus | null
  toStatus: WorkspaceReportStatus
  note: string | null
  createdAt: Date
}

type ListWorkspaceReportsServiceInput = Omit<ListReportsInput, "sort"> & {
  exactStatus?: WorkspaceReportStatus
  sort: WorkspaceReportSort | "priority_oldest"
}

export type WorkspaceImplementationQueueStatus = "assigned" | "in_progress"

export type BulkCreatedTask = {
  assigneeUserId: string | null
  clientTaskId: string
  created: boolean
  reportId: string
  status: WorkspaceReportStatus
  title: string
}

export type AssignableWorkspaceReportMember = {
  email: string
  name: string
  role: "developer" | "designer"
  title: string | null
  userId: string
}

type BulkTaskInput = BulkCreateTasksInput["tasks"][number]

type ResolvedBulkTask = {
  assigneeUserId: string | null
  implementationBrief: ReturnType<
    typeof normalizeBulkTaskImplementationBrief
  >
  input: BulkTaskInput
  payloadHash: string
  url: string | null
}

const statusRequiresAssignee = new Set<WorkspaceReportStatus>([
  "assigned",
  "in_progress",
  "ready_for_review",
])
const assignedMemberNoteKinds = new Set<WorkspaceReportNoteKind>([
  "work_note",
  "blocker",
  "clarification_request",
])

const statusResetsWhenUnassigned = new Set<WorkspaceReportStatus>(["assigned"])
const defaultReportCommentsPageSize = 10
const notificationTextMaxLength = 180

function canAdministerReports(role: string) {
  return role === "owner" || role === "admin"
}

function getReportNotificationHref(
  workspaceSlug: string,
  reportId: string,
  tab?: "activity" | "comments",
  commentId?: string
) {
  const searchParams = new URLSearchParams()

  if (tab) {
    searchParams.set("tab", tab)
  }

  if (commentId) {
    searchParams.set("comment", commentId)
  }

  const queryString = searchParams.toString()

  return `/${workspaceSlug}/reports/${reportId}${
    queryString ? `?${queryString}` : ""
  }`
}

function truncateNotificationBody(value: string) {
  const normalized = value.trim().replace(/\s+/g, " ")

  if (normalized.length <= notificationTextMaxLength) {
    return normalized
  }

  return `${normalized.slice(0, notificationTextMaxLength - 1).trim()}…`
}

function isAssignedImplementationMember(
  role: WorkspaceMemberRole,
  userId: string,
  report: Pick<ReportRow, "assigneeUserId">
) {
  return isAssignableReportRole(role) && report.assigneeUserId === userId
}

function commentsCountSql() {
  return sql<number>`(
    select count(*)::int
    from report_comments as counted_comments
    where counted_comments.workspace_id = ${reports.workspaceId}
      and counted_comments.report_id = ${reports.id}
      and counted_comments.deleted_at is null
  )`.mapWith(Number)
}

function sqlValues(values: string[]) {
  return sql.join(
    values.map((value) => sql`${value}`),
    sql`, `
  )
}

function encodeReportsCursor(offset: number) {
  return Buffer.from(JSON.stringify({ offset }), "utf8").toString("base64url")
}

function decodeReportsCursor(cursor?: string) {
  if (!cursor) {
    return 0
  }

  try {
    const decoded = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8")
    ) as { offset?: unknown }

    if (
      typeof decoded.offset === "number" &&
      Number.isInteger(decoded.offset) &&
      decoded.offset >= 0
    ) {
      return decoded.offset
    }
  } catch {
    // The validation error below keeps the API response consistent.
  }

  throw new ValidationError("The report page cursor is invalid.", {
    cursor: ["Refresh the page and try again."],
  })
}

function encodeCommentsCursor(offset: number) {
  return Buffer.from(JSON.stringify({ offset }), "utf8").toString("base64url")
}

function decodeCommentsCursor(cursor?: string) {
  if (!cursor) {
    return 0
  }

  try {
    const decoded = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8")
    ) as { offset?: unknown }

    if (
      typeof decoded.offset === "number" &&
      Number.isInteger(decoded.offset) &&
      decoded.offset >= 0
    ) {
      return decoded.offset
    }
  } catch {
    // The validation error below keeps the API response consistent.
  }

  throw new ValidationError("The comments page cursor is invalid.", {
    cursor: ["Refresh the page and try again."],
  })
}

function getCommentsPageInfo({
  hasNextPage,
  limit,
  offset,
  pageSize,
}: {
  hasNextPage: boolean
  limit: number
  offset: number
  pageSize: number
}): WorkspaceReportCommentsPageInfo {
  return {
    hasNextPage,
    limit,
    nextCursor: hasNextPage ? encodeCommentsCursor(offset + pageSize) : null,
  }
}

function getReportStatusCondition(
  status: ListReportsInput["status"],
  exactStatus?: WorkspaceReportStatus
) {
  if (exactStatus) {
    return eq(reports.status, exactStatus)
  }

  if (status === "open") {
    return inArray(reports.status, [...activeReportStatuses])
  }

  if (status === "in_progress") {
    return inArray(reports.status, [...progressReportStatuses])
  }

  if (status === "resolved") {
    return eq(reports.status, "resolved")
  }

  return undefined
}

function getReportScopeCondition(
  scope: ListReportsInput["scope"],
  userId: string
) {
  if (scope === "assigned") {
    return and(
      eq(reports.assigneeUserId, userId),
      inArray(reports.status, [...progressReportStatuses])
    )
  }

  if (scope === "reported") {
    return eq(reports.reporterUserId, userId)
  }

  return undefined
}

function getReportSearchCondition(query?: string) {
  if (!query) {
    return undefined
  }

  const searchTerm = `%${query}%`

  return or(
    ilike(reports.title, searchTerm),
    ilike(reports.summary, searchTerm),
    ilike(reports.domain, searchTerm),
    ilike(reports.url, searchTerm),
    ilike(reports.feedbackMessage, searchTerm)
  )
}

function getReportOrderBy(
  sort: WorkspaceReportSort | "priority_oldest"
) {
  const newestFirst = [desc(reports.capturedAt), desc(reports.id)]
  const severityRank = sql`case ${reports.severity}
    when 'urgent' then 0
    when 'high' then 1
    when 'medium' then 2
    else 3
  end`

  if (sort === "oldest") {
    return [asc(reports.capturedAt), asc(reports.id)]
  }

  if (sort === "priority") {
    return [
      asc(severityRank),
      ...newestFirst,
    ]
  }

  if (sort === "priority_oldest") {
    const assignedAt = sql`coalesce((
      select max(assignment_event.created_at)
      from report_status_events assignment_event
      where assignment_event.workspace_id = ${reports.workspaceId}
        and assignment_event.report_id = ${reports.id}
        and assignment_event.to_status = 'assigned'
    ), ${reports.capturedAt})`

    return [
      asc(severityRank),
      asc(assignedAt),
      asc(reports.capturedAt),
      asc(reports.id),
    ]
  }

  if (sort === "comments") {
    return [desc(commentsCountSql()), ...newestFirst]
  }

  return newestFirst
}

function getReportBaseConditions(
  workspaceId: string,
  input: Pick<ReportCountsInput, "q" | "scope">,
  userId: string
) {
  const conditions: SQL[] = [
    eq(reports.workspaceId, workspaceId),
    isNull(reports.archivedAt),
  ]
  const scopeCondition = getReportScopeCondition(input.scope, userId)
  const searchCondition = getReportSearchCondition(input.q)

  if (scopeCondition) {
    conditions.push(scopeCondition)
  }

  if (searchCondition) {
    conditions.push(searchCondition)
  }

  return conditions
}

function getReportsPageInfo({
  hasNextPage,
  limit,
  offset,
  pageSize,
}: {
  hasNextPage: boolean
  limit: number
  offset: number
  pageSize: number
}): WorkspaceReportsPageInfo {
  return {
    hasNextPage,
    limit,
    nextCursor: hasNextPage ? encodeReportsCursor(offset + pageSize) : null,
  }
}

function reportSelectFields() {
  return {
    id: reports.id,
    title: reports.title,
    summary: reports.summary,
    severity: reports.severity,
    status: reports.status,
    type: reports.type,
    source: reports.source,
    domain: reports.domain,
    url: reports.url,
    browser: reports.browser,
    device: reports.device,
    viewport: reports.viewport,
    selectedElement: reports.selectedElement,
    feedbackMessage: reports.feedbackMessage,
    developerPrompt: reports.developerPrompt,
    reporterUserId: reports.reporterUserId,
    assigneeUserId: reports.assigneeUserId,
    capturedAt: reports.capturedAt,
    commentsCount: commentsCountSql(),
  }
}

async function requireWorkspaceForReportsRead(userId: string, workspaceSlug: string) {
  const workspace = await getWorkspaceForUserBySlug(userId, workspaceSlug)

  if (!workspace) {
    throw new NotFoundError("Workspace not found.")
  }

  assertCanWorkspaceRole(workspace.role, "report:read")

  return workspace
}

async function requireWorkspaceForReportCreate(userId: string, workspaceSlug: string) {
  const workspace = await getWorkspaceForUserBySlug(userId, workspaceSlug)

  if (!workspace) {
    throw new NotFoundError("Workspace not found.")
  }

  assertCanWorkspaceRole(workspace.role, "report:create")

  return workspace
}

async function requireWorkspaceForReportAssign(userId: string, workspaceSlug: string) {
  const workspace = await getWorkspaceForUserBySlug(userId, workspaceSlug)

  if (!workspace) {
    throw new NotFoundError("Workspace not found.")
  }

  assertCanWorkspaceRole(workspace.role, "report:assign")

  return workspace
}

async function requireWorkspaceForReportBriefUpdate(
  userId: string,
  workspaceSlug: string
) {
  const workspace = await getWorkspaceForUserBySlug(userId, workspaceSlug)

  if (!workspace) {
    throw new NotFoundError("Workspace not found.")
  }

  assertCanWorkspaceRole(workspace.role, "report:update_brief")

  return workspace
}

async function requireWorkspaceForReportNote(
  userId: string,
  workspaceSlug: string
) {
  const workspace = await getWorkspaceForUserBySlug(userId, workspaceSlug)

  if (!workspace) {
    throw new NotFoundError("Workspace not found.")
  }

  assertCanWorkspaceRole(workspace.role, "report:comment")

  return workspace
}

async function requireWorkspaceForReportStatusUpdate(
  userId: string,
  workspaceSlug: string,
  status: WorkspaceReportStatus
) {
  const workspace = await getWorkspaceForUserBySlug(userId, workspaceSlug)

  if (!workspace) {
    throw new NotFoundError("Workspace not found.")
  }

  if (status === "resolved" || status === "archived") {
    assertCanWorkspaceRole(workspace.role, "report:resolve")
  } else if (status === "ready_for_review") {
    assertCanWorkspaceRole(workspace.role, "report:mark_ready_for_review")
  } else {
    assertCanWorkspaceRole(workspace.role, "report:update_status")
  }

  return workspace
}

async function getPeopleById(userIds: string[]) {
  const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)))

  if (uniqueUserIds.length === 0) {
    return new Map<string, ReportPerson>()
  }

  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      fullName: userProfiles.fullName,
      displayName: userProfiles.displayName,
      avatarUrl: userProfiles.avatarUrl,
    })
    .from(users)
    .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
    .where(inArray(users.id, uniqueUserIds))

  return new Map(rows.map((row) => [row.id, row]))
}

function compactUserIds(userIds: Array<string | null | undefined>) {
  return userIds.filter((userId): userId is string => Boolean(userId))
}

function getPersonName(person: ReportPerson | undefined, fallback: string) {
  if (!person) {
    return fallback
  }

  return (
    person.fullName?.trim() ||
    person.displayName?.trim() ||
    getNameFromEmail(person.email)
  )
}

function formatViewport(viewport: ReportViewport | null) {
  return viewport ? `${viewport.width} x ${viewport.height}` : null
}

function normalizeSelectedElement(
  selectedElement: ReportSelectedElement | null
): WorkspaceReport["selectedElement"] {
  if (!selectedElement) {
    return null
  }

  return {
    tag: selectedElement.tag || "element",
    selector: selectedElement.selector || "unknown",
    text: selectedElement.text,
    attributes: selectedElement.attributes ?? {},
  }
}

function getDefaultScreenshots(reportId: string): WorkspaceReport["screenshots"] {
  return [
    {
      id: `${reportId}-page`,
      label: "Page",
      kind: "page",
    },
    {
      id: `${reportId}-annotated`,
      label: "Annotated",
      kind: "annotated",
    },
  ]
}

function getScreenshotsFromAssets(
  reportId: string,
  assets: ReportAssetRow[] = [],
  source: WorkspaceReport["source"] = "feedback"
): WorkspaceReport["screenshots"] {
  if (assets.length === 0) {
    return source === "feedback" ? getDefaultScreenshots(reportId) : []
  }

  return assets.map((asset) => {
    if (asset.type === "page_screenshot") {
      return {
        id: asset.id,
        label: "Page",
        kind: "page",
        url: asset.url,
        thumbnailUrl: buildCloudinaryThumbnailUrl(asset.url),
        width: asset.width,
        height: asset.height,
      }
    }

    return {
      id: asset.id,
      label: asset.type === "element_screenshot" ? "Element" : "Annotated",
      kind: "annotated",
      url: asset.url,
      thumbnailUrl: buildCloudinaryThumbnailUrl(asset.url),
      width: asset.width,
      height: asset.height,
    }
  })
}

function serializeReportImplementationBrief(
  row: ReportImplementationBriefRow | null,
  peopleById: Map<string, ReportPerson>
): WorkspaceReport["implementationBrief"] {
  if (!row) {
    return null
  }

  const updatedBy = row.updatedByUserId
    ? peopleById.get(row.updatedByUserId)
    : undefined
  const updatedByName = getPersonName(updatedBy, "Unknown teammate")

  return {
    acceptanceCriteria: row.acceptanceCriteria,
    implementationNotes: row.implementationNotes,
    constraintsNonGoals: row.constraintsNonGoals,
    expectedBehavior: row.expectedBehavior,
    referenceLinks: row.referenceLinks,
    reviewChecklist: row.reviewChecklist,
    updatedAt: row.updatedAt.toISOString(),
    updatedBy: updatedBy
      ? {
          id: updatedBy.id,
          name: updatedByName,
          email: updatedBy.email,
          avatarUrl: updatedBy.avatarUrl,
        }
      : null,
  }
}

function serializeActivityActor(
  userId: string | null,
  peopleById: Map<string, ReportPerson>
): WorkspaceReportActivityActor | null {
  if (!userId) {
    return null
  }

  const person = peopleById.get(userId)

  if (!person) {
    return null
  }

  return {
    id: person.id,
    name: getPersonName(person, "Unknown teammate"),
    email: person.email,
    avatarUrl: person.avatarUrl,
  }
}

function serializeReportActivity(
  notes: ReportNoteRow[],
  statusEvents: ReportStatusEventRow[],
  peopleById: Map<string, ReportPerson>
): WorkspaceReportActivityItem[] {
  const noteItems: WorkspaceReportActivityItem[] = notes.map((note) => ({
    id: note.id,
    type: "note",
    kind: note.kind,
    body: note.body,
    createdAt: note.createdAt.toISOString(),
    createdAgo: formatReportCapturedAgo(note.createdAt),
    author: serializeActivityActor(note.authorUserId, peopleById),
  }))
  const statusItems: WorkspaceReportActivityItem[] = statusEvents.map((event) => ({
    id: event.id,
    type: "status",
    fromStatus: event.fromStatus,
    toStatus: event.toStatus,
    note: event.note,
    createdAt: event.createdAt.toISOString(),
    createdAgo: formatReportCapturedAgo(event.createdAt),
    actor: serializeActivityActor(event.actorUserId, peopleById),
  }))

  return [...noteItems, ...statusItems].sort(
    (first, second) =>
      new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime()
  )
}

function serializeReportComments(
  comments: ReportCommentRow[],
  peopleById: Map<string, ReportPerson>
): WorkspaceReportComment[] {
  const commentsById = new Map<string, WorkspaceReportComment>()
  const roots: WorkspaceReportComment[] = []

  for (const comment of comments) {
    const isDeleted = Boolean(comment.deletedAt)

    commentsById.set(comment.id, {
      id: comment.id,
      parentCommentId: comment.parentCommentId,
      body: isDeleted ? "Comment deleted" : comment.body,
      createdAt: comment.createdAt.toISOString(),
      createdAgo: formatReportCapturedAgo(comment.createdAt),
      editedAt: comment.editedAt?.toISOString() ?? null,
      isDeleted,
      author: isDeleted
        ? null
        : serializeActivityActor(comment.authorUserId, peopleById),
      mentions: isDeleted ? [] : comment.mentions,
      reactions: isDeleted ? [] : comment.reactions,
      replyCount: comment.replyCount,
      replies: [],
    })
  }

  for (const comment of comments) {
    const serializedComment = commentsById.get(comment.id)

    if (!serializedComment) {
      continue
    }

    const parent = comment.parentCommentId
      ? commentsById.get(comment.parentCommentId)
      : undefined

    if (parent) {
      parent.replies.push(serializedComment)
    } else {
      roots.push(serializedComment)
    }
  }

  return roots
}

function serializeReportComment(
  comment: ReportCommentRow,
  peopleById: Map<string, ReportPerson>
): WorkspaceReportComment {
  const isDeleted = Boolean(comment.deletedAt)

  return {
    id: comment.id,
    parentCommentId: comment.parentCommentId,
    body: isDeleted ? "Comment deleted" : comment.body,
    createdAt: comment.createdAt.toISOString(),
    createdAgo: formatReportCapturedAgo(comment.createdAt),
    editedAt: comment.editedAt?.toISOString() ?? null,
    isDeleted,
    author: isDeleted
      ? null
      : serializeActivityActor(comment.authorUserId, peopleById),
    mentions: isDeleted ? [] : comment.mentions,
    reactions: isDeleted ? [] : comment.reactions,
    replyCount: comment.replyCount,
    replies: [],
  }
}

function buildDeveloperPrompt(row: ReportRow) {
  return (
    row.developerPrompt ??
    (row.source === "task"
      ? `Complete this task: ${row.feedbackMessage}`
      : `Review ${row.url}. Feedback: ${row.feedbackMessage}`)
  )
}

function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value
  }

  return `${value.slice(0, maxLength - 1).trimEnd()}...`
}

function buildReportTitle(input: CreateReportInput, domain: string) {
  if (input.title) {
    return input.title
  }

  const elementLabel =
    input.selectedElement.text || input.selectedElement.selector || input.selectedElement.tag

  return truncateText(`Feedback on ${elementLabel} at ${domain}`, 180)
}

function buildReportSummary(input: CreateReportInput) {
  return input.summary ?? truncateText(input.feedbackMessage, 500)
}

function buildCreateDeveloperPrompt(input: CreateReportInput, domain: string) {
  if (input.developerPrompt) {
    return input.developerPrompt
  }

  return [
    `Review feedback captured on ${domain}.`,
    `URL: ${input.url}`,
    `Selected element: ${input.selectedElement.selector}`,
    input.selectedElement.text ? `Element text: ${input.selectedElement.text}` : null,
    `Feedback: ${input.feedbackMessage}`,
  ]
    .filter(Boolean)
    .join("\n")
}

function parseCapturedAt(input: CreateReportInput) {
  if (!input.capturedAt) {
    return new Date()
  }

  return new Date(input.capturedAt)
}

async function assertWorkspaceAllowsReportDomain(
  workspaceId: string,
  domain: string
) {
  const [workspaceDomain] = await db
    .select({ id: workspaceDomains.id })
    .from(workspaceDomains)
    .where(
      and(
        eq(workspaceDomains.workspaceId, workspaceId),
        eq(workspaceDomains.host, domain),
        inArray(workspaceDomains.status, ["active", "verified"])
      )
    )
    .limit(1)

  if (!workspaceDomain) {
    throw new ValidationError("This URL is not allowed for the workspace.", {
      url: ["Add this exact domain to the workspace before submitting reports."],
    })
  }
}

function serializeReport(
  row: ReportRow,
  peopleById: Map<string, ReportPerson>,
  assets: ReportAssetRow[] = [],
  implementationBrief?: WorkspaceReport["implementationBrief"],
  activity?: WorkspaceReport["activity"],
  comments?: WorkspaceReport["comments"],
  commentsPageInfo?: WorkspaceReport["commentsPageInfo"]
): WorkspaceReport {
  const reporter = row.reporterUserId
    ? peopleById.get(row.reporterUserId)
    : undefined
  const assignee = row.assigneeUserId
    ? peopleById.get(row.assigneeUserId)
    : undefined
  const reporterName = getPersonName(reporter, "Unknown reporter")
  const assigneeName = getPersonName(assignee, "Unassigned")

  const report: WorkspaceReport = {
    id: row.id,
    reporterUserId: row.reporterUserId,
    assigneeUserId: row.assigneeUserId,
    title: row.title,
    summary: row.summary,
    severity: row.severity,
    status: row.status,
    type: row.type,
    source: row.source,
    domain: row.domain,
    url: row.url,
    browser: row.browser ?? "Unknown browser",
    device: row.device ?? "Unknown device",
    viewport: formatViewport(row.viewport),
    capturedAt: formatReportCapturedAt(row.capturedAt),
    capturedAtIso: row.capturedAt.toISOString(),
    capturedAgo: formatReportCapturedAgo(row.capturedAt),
    screenshots: getScreenshotsFromAssets(row.id, assets, row.source),
    selectedElement: normalizeSelectedElement(row.selectedElement),
    feedback: {
      message: row.feedbackMessage,
      reporterName,
      reporterEmail: reporter?.email ?? "unknown",
      reporterAvatarUrl: reporter?.avatarUrl ?? null,
    },
    developerPrompt: buildDeveloperPrompt(row),
    assignee: assignee
      ? {
          name: assigneeName,
          initials: getInitialsFromName(assigneeName),
          avatarUrl: assignee.avatarUrl,
        }
      : undefined,
    commentsCount: row.commentsCount,
  }

  if (implementationBrief !== undefined) {
    report.implementationBrief = implementationBrief
  }

  if (activity !== undefined) {
    report.activity = activity
  }

  if (comments !== undefined) {
    report.comments = comments
  }

  if (commentsPageInfo !== undefined) {
    report.commentsPageInfo = commentsPageInfo
  }

  return report
}

// Lightweight per-report page screenshot for the list/grid. Now that assets are
// small Cloudinary URLs (not base64), including one thumbnail URL per row is cheap
// and lets grid cards render real evidence instead of a placeholder.
async function getPageScreenshotAssets(workspaceId: string, reportIds: string[]) {
  const assetsByReportId = new Map<string, ReportAssetRow>()

  if (reportIds.length === 0) {
    return assetsByReportId
  }

  const rows = await db
    .select({
      id: reportAssets.id,
      reportId: reportAssets.reportId,
      type: reportAssets.type,
      url: reportAssets.url,
      width: reportAssets.width,
      height: reportAssets.height,
    })
    .from(reportAssets)
    .where(
      and(
        eq(reportAssets.workspaceId, workspaceId),
        inArray(reportAssets.reportId, reportIds),
        eq(reportAssets.type, "page_screenshot")
      )
    )
    .orderBy(asc(reportAssets.createdAt))

  for (const row of rows) {
    if (!assetsByReportId.has(row.reportId)) {
      assetsByReportId.set(row.reportId, row)
    }
  }

  return assetsByReportId
}

async function getAssetsForReport(workspaceId: string, reportId: string) {
  return db
    .select({
      id: reportAssets.id,
      reportId: reportAssets.reportId,
      type: reportAssets.type,
      url: reportAssets.url,
      width: reportAssets.width,
      height: reportAssets.height,
    })
    .from(reportAssets)
    .where(
      and(
        eq(reportAssets.workspaceId, workspaceId),
        eq(reportAssets.reportId, reportId)
      )
    )
    .orderBy(asc(reportAssets.createdAt))
}

async function getImplementationBriefForReport(
  workspaceId: string,
  reportId: string
) {
  const [row] = await db
    .select({
      acceptanceCriteria: reportImplementationBriefs.acceptanceCriteria,
      implementationNotes: reportImplementationBriefs.implementationNotes,
      constraintsNonGoals: reportImplementationBriefs.constraintsNonGoals,
      expectedBehavior: reportImplementationBriefs.expectedBehavior,
      referenceLinks: reportImplementationBriefs.referenceLinks,
      reviewChecklist: reportImplementationBriefs.reviewChecklist,
      updatedAt: reportImplementationBriefs.updatedAt,
      updatedByUserId: reportImplementationBriefs.updatedByUserId,
    })
    .from(reportImplementationBriefs)
    .where(
      and(
        eq(reportImplementationBriefs.workspaceId, workspaceId),
        eq(reportImplementationBriefs.reportId, reportId)
      )
    )
    .limit(1)

  return row ?? null
}

function reportCommentSelectFields() {
  return {
    id: reportComments.id,
    parentCommentId: reportComments.parentCommentId,
    authorUserId: reportComments.authorUserId,
    body: reportComments.body,
    createdAt: reportComments.createdAt,
    editedAt: reportComments.editedAt,
    deletedAt: reportComments.deletedAt,
  }
}

const reportCommentReactionOrder: WorkspaceReportCommentReactionKind[] = [
  "seen",
  "agree",
  "blocked",
  "helpful",
]

async function getReplyCountsForComments(
  workspaceId: string,
  reportId: string,
  commentIds: string[]
) {
  const countsByCommentId = new Map<string, number>()

  if (commentIds.length === 0) {
    return countsByCommentId
  }

  const rows = await db
    .select({
      count: sql<number>`count(*)::int`.mapWith(Number),
      parentCommentId: reportComments.parentCommentId,
    })
    .from(reportComments)
    .where(
      and(
        eq(reportComments.workspaceId, workspaceId),
        eq(reportComments.reportId, reportId),
        inArray(reportComments.parentCommentId, commentIds),
        isNull(reportComments.deletedAt)
      )
    )
    .groupBy(reportComments.parentCommentId)

  for (const row of rows) {
    if (row.parentCommentId) {
      countsByCommentId.set(row.parentCommentId, row.count)
    }
  }

  return countsByCommentId
}

async function getReactionSummariesForComments(
  workspaceId: string,
  reportId: string,
  commentIds: string[],
  userId: string
) {
  const reactionsByCommentId = new Map<
    string,
    WorkspaceReportCommentReactionSummary[]
  >()

  if (commentIds.length === 0) {
    return reactionsByCommentId
  }

  const rows = await db
    .select({
      commentId: reportCommentReactions.commentId,
      count: sql<number>`count(*)::int`.mapWith(Number),
      reactedByCurrentUser:
        sql<boolean>`bool_or(${reportCommentReactions.userId} = ${userId})`,
      reaction: reportCommentReactions.reaction,
    })
    .from(reportCommentReactions)
    .where(
      and(
        eq(reportCommentReactions.workspaceId, workspaceId),
        eq(reportCommentReactions.reportId, reportId),
        inArray(reportCommentReactions.commentId, commentIds)
      )
    )
    .groupBy(reportCommentReactions.commentId, reportCommentReactions.reaction)

  for (const row of rows) {
    const reactions = reactionsByCommentId.get(row.commentId) ?? []

    reactions.push({
      reaction: row.reaction,
      count: row.count,
      reactedByCurrentUser: Boolean(row.reactedByCurrentUser),
    })
    reactionsByCommentId.set(row.commentId, reactions)
  }

  for (const [commentId, reactions] of reactionsByCommentId.entries()) {
    reactionsByCommentId.set(
      commentId,
      reactions.sort(
        (first, second) =>
          reportCommentReactionOrder.indexOf(first.reaction) -
          reportCommentReactionOrder.indexOf(second.reaction)
      )
    )
  }

  return reactionsByCommentId
}

async function getMentionSummariesForComments(
  workspaceId: string,
  reportId: string,
  commentIds: string[]
) {
  const mentionsByCommentId = new Map<string, WorkspaceReportActivityActor[]>()

  if (commentIds.length === 0) {
    return mentionsByCommentId
  }

  const rows = await db
    .select({
      avatarUrl: userProfiles.avatarUrl,
      commentId: reportCommentMentions.commentId,
      displayName: userProfiles.displayName,
      email: users.email,
      fullName: userProfiles.fullName,
      id: users.id,
    })
    .from(reportCommentMentions)
    .innerJoin(users, eq(users.id, reportCommentMentions.mentionedUserId))
    .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
    .where(
      and(
        eq(reportCommentMentions.workspaceId, workspaceId),
        eq(reportCommentMentions.reportId, reportId),
        inArray(reportCommentMentions.commentId, commentIds)
      )
    )
    .orderBy(asc(reportCommentMentions.createdAt), asc(reportCommentMentions.id))

  for (const row of rows) {
    const mentions = mentionsByCommentId.get(row.commentId) ?? []

    mentions.push({
      id: row.id,
      name: getPersonName(row, "Unknown teammate"),
      email: row.email,
      avatarUrl: row.avatarUrl,
    })
    mentionsByCommentId.set(row.commentId, mentions)
  }

  return mentionsByCommentId
}

async function withCommentMetadata(
  workspaceId: string,
  reportId: string,
  userId: string,
  rows: Array<Omit<ReportCommentRow, "mentions" | "reactions" | "replyCount">>
): Promise<ReportCommentRow[]> {
  const commentIds = rows.map((row) => row.id)
  const [
    countsByCommentId,
    mentionsByCommentId,
    reactionsByCommentId,
  ] = await Promise.all([
    getReplyCountsForComments(workspaceId, reportId, commentIds),
    getMentionSummariesForComments(workspaceId, reportId, commentIds),
    getReactionSummariesForComments(workspaceId, reportId, commentIds, userId),
  ])

  return rows.map((row) => ({
    ...row,
    mentions: mentionsByCommentId.get(row.id) ?? [],
    reactions: reactionsByCommentId.get(row.id) ?? [],
    replyCount: countsByCommentId.get(row.id) ?? 0,
  }))
}

async function getCommentRowsForReportPage(
  workspaceId: string,
  reportId: string,
  userId: string,
  input: ListReportCommentsInput = {
    limit: defaultReportCommentsPageSize,
  }
) {
  if (input.targetCommentId) {
    return getCommentRowsForTarget(workspaceId, reportId, userId, input)
  }

  const offset = decodeCommentsCursor(input.cursor)
  const limit = input.limit ?? defaultReportCommentsPageSize
  const parentCondition = input.parentCommentId
    ? eq(reportComments.parentCommentId, input.parentCommentId)
    : isNull(reportComments.parentCommentId)
  const hasVisibleDescendantSql = sql`exists (
    with recursive visible_descendants as (
      select child_comments.id, child_comments.deleted_at
      from report_comments as child_comments
      where child_comments.parent_comment_id = ${reportComments.id}
        and child_comments.workspace_id = ${workspaceId}
        and child_comments.report_id = ${reportId}

      union all

      select child_comments.id, child_comments.deleted_at
      from report_comments as child_comments
      inner join visible_descendants
        on child_comments.parent_comment_id = visible_descendants.id
      where child_comments.workspace_id = ${workspaceId}
        and child_comments.report_id = ${reportId}
    )
    select 1
    from visible_descendants
    where visible_descendants.deleted_at is null
  )`
  const rows = await db
    .select({
      ...reportCommentSelectFields(),
    })
    .from(reportComments)
    .where(
      and(
        eq(reportComments.workspaceId, workspaceId),
        eq(reportComments.reportId, reportId),
        parentCondition,
        or(isNull(reportComments.deletedAt), hasVisibleDescendantSql)
      )
    )
    .orderBy(asc(reportComments.createdAt), asc(reportComments.id))
    .limit(limit + 1)
    .offset(offset)
  const pageRows = rows.slice(0, limit)
  const hasNextPage = rows.length > limit
  const countedRows = await withCommentMetadata(
    workspaceId,
    reportId,
    userId,
    pageRows
  )

  return {
    rows: countedRows,
    pageInfo: getCommentsPageInfo({
      hasNextPage,
      limit,
      offset,
      pageSize: pageRows.length,
    }),
  }
}

async function getCommentRowsForTarget(
  workspaceId: string,
  reportId: string,
  userId: string,
  input: ListReportCommentsInput
) {
  const targetCommentId = input.targetCommentId
  const limit = input.limit ?? defaultReportCommentsPageSize
  const commentRows: Array<
    Omit<ReportCommentRow, "mentions" | "reactions" | "replyCount">
  > = []
  const visitedCommentIds = new Set<string>()
  let currentCommentId: string | null | undefined = targetCommentId

  while (currentCommentId && !visitedCommentIds.has(currentCommentId)) {
    visitedCommentIds.add(currentCommentId)

    const [row] = await db
      .select({
        ...reportCommentSelectFields(),
      })
      .from(reportComments)
      .where(
        and(
          eq(reportComments.workspaceId, workspaceId),
          eq(reportComments.reportId, reportId),
          eq(reportComments.id, currentCommentId)
        )
      )
      .limit(1)

    if (!row) {
      break
    }

    commentRows.push(row)
    currentCommentId = row.parentCommentId
  }

  const countedRows = await withCommentMetadata(
    workspaceId,
    reportId,
    userId,
    commentRows.reverse()
  )

  return {
    rows: countedRows,
    pageInfo: getCommentsPageInfo({
      hasNextPage: false,
      limit,
      offset: 0,
      pageSize: countedRows.length,
    }),
  }
}

async function getReportCommentsCount(workspaceId: string, reportId: string) {
  const [row] = await db
    .select({
      count: sql<number>`count(*)::int`.mapWith(Number),
    })
    .from(reportComments)
    .where(
      and(
        eq(reportComments.workspaceId, workspaceId),
        eq(reportComments.reportId, reportId),
        isNull(reportComments.deletedAt)
      )
    )

  return row?.count ?? 0
}

async function getReportCommentsCounts(
  workspaceId: string,
  reportIds: string[]
) {
  const countsByReportId = new Map<string, number>()

  if (reportIds.length === 0) {
    return countsByReportId
  }

  const rows = await db
    .select({
      count: sql<number>`count(*)::int`.mapWith(Number),
      reportId: reportComments.reportId,
    })
    .from(reportComments)
    .where(
      and(
        eq(reportComments.workspaceId, workspaceId),
        inArray(reportComments.reportId, reportIds),
        isNull(reportComments.deletedAt)
      )
    )
    .groupBy(reportComments.reportId)

  for (const row of rows) {
    countsByReportId.set(row.reportId, row.count)
  }

  return countsByReportId
}

async function getNotesForReport(workspaceId: string, reportId: string) {
  return db
    .select({
      id: reportNotes.id,
      authorUserId: reportNotes.authorUserId,
      kind: reportNotes.kind,
      body: reportNotes.body,
      createdAt: reportNotes.createdAt,
    })
    .from(reportNotes)
    .where(
      and(
        eq(reportNotes.workspaceId, workspaceId),
        eq(reportNotes.reportId, reportId),
        isNull(reportNotes.deletedAt)
      )
    )
    .orderBy(desc(reportNotes.createdAt))
    .limit(30)
}

async function getStatusEventsForReport(workspaceId: string, reportId: string) {
  return db
    .select({
      id: reportStatusEvents.id,
      actorUserId: reportStatusEvents.actorUserId,
      fromStatus: reportStatusEvents.fromStatus,
      toStatus: reportStatusEvents.toStatus,
      note: reportStatusEvents.note,
      createdAt: reportStatusEvents.createdAt,
    })
    .from(reportStatusEvents)
    .where(
      and(
        eq(reportStatusEvents.workspaceId, workspaceId),
        eq(reportStatusEvents.reportId, reportId)
      )
    )
    .orderBy(desc(reportStatusEvents.createdAt))
    .limit(30)
}

async function getMutableReportRow(workspaceId: string, reportId: string) {
  const [row] = await db
    .select(reportSelectFields())
    .from(reports)
    .where(
      and(
        eq(reports.workspaceId, workspaceId),
        eq(reports.id, reportId),
        isNull(reports.archivedAt)
      )
    )
    .limit(1)

  if (!row) {
    throw new NotFoundError("Report not found.")
  }

  return row
}

async function getReportIdByClientReportId(
  workspaceId: string,
  clientReportId: string
) {
  const [row] = await db
    .select({ id: reports.id })
    .from(reports)
    .where(
      and(
        eq(reports.workspaceId, workspaceId),
        eq(reports.clientReportId, clientReportId)
      )
    )
    .limit(1)

  return row?.id ?? null
}

async function assertAssignableReportMember(workspaceId: string, userId: string) {
  const [member] = await db
    .select({ id: workspaceMemberships.id })
    .from(workspaceMemberships)
    .where(
      and(
        eq(workspaceMemberships.workspaceId, workspaceId),
        eq(workspaceMemberships.userId, userId),
        inArray(workspaceMemberships.role, [...assignableReportRoles]),
        eq(workspaceMemberships.status, "active")
      )
    )
    .limit(1)

  if (!member) {
    throw new ValidationError(
      "Reports can only be assigned to active developers or designers.",
      {
        assigneeUserId: [
          "Choose an active developer or designer in this workspace.",
        ],
      }
    )
  }
}

function getAssignmentStatus(
  currentStatus: WorkspaceReportStatus,
  nextAssigneeUserId: string | null,
  didChangeAssignee: boolean
) {
  if (!didChangeAssignee) {
    return currentStatus
  }

  if (nextAssigneeUserId) {
    return "assigned"
  }

  if (statusResetsWhenUnassigned.has(currentStatus)) {
    return "reviewing"
  }

  return currentStatus
}

function getResolvedAtForStatus(status: WorkspaceReportStatus) {
  return status === "resolved" ? new Date() : null
}

async function applyReportStatusTransitionAtomic({
  actorUserId,
  fromStatus,
  note,
  outboxValues,
  reportId,
  statusEventId,
  toStatus,
  workspaceId,
}: {
  actorUserId: string
  fromStatus: WorkspaceReportStatus
  note?: string
  outboxValues?: typeof notificationOutbox.$inferInsert | null
  reportId: string
  statusEventId: string
  toStatus: WorkspaceReportStatus
  workspaceId: string
}) {
  const now = new Date()
  const eventNote = note ?? `Status changed to ${toStatus.replace(/_/g, " ")}.`
  const readyForReviewNote =
    toStatus === "ready_for_review" ? note?.trim() || null : null
  const noteCte = readyForReviewNote
    ? sql`, inserted_ready_note AS (
        INSERT INTO ${reportNotes}
          ("workspace_id", "report_id", "author_user_id", "kind", "body")
        SELECT ${workspaceId}, ${reportId}, ${actorUserId}, 'work_note', ${readyForReviewNote}
        FROM updated_report
      )`
    : sql.empty()
  const outboxCte = outboxValues
    ? sql`, queued_notification AS (
        INSERT INTO ${notificationOutbox} (
          "id",
          "workspace_id",
          "dedupe_key",
          "payload"
        )
        SELECT
          ${outboxValues.id},
          ${outboxValues.workspaceId},
          ${outboxValues.dedupeKey},
          CAST(${JSON.stringify(outboxValues.payload)} AS jsonb)
        FROM updated_report
        ON CONFLICT ("workspace_id", "dedupe_key") DO NOTHING
      )`
    : sql.empty()
  const result = await db.execute<{ updated: boolean }>(sql`
    WITH updated_report AS (
      UPDATE ${reports}
      SET
        "archived_at" = ${toStatus === "archived" ? now : null},
        "resolved_at" = ${getResolvedAtForStatus(toStatus)},
        "status" = ${toStatus},
        "updated_at" = ${now}
      WHERE "workspace_id" = ${workspaceId}
        AND "id" = ${reportId}
        AND "status" = ${fromStatus}
      RETURNING "id"
    ), inserted_status_event AS (
      INSERT INTO ${reportStatusEvents}
        ("id", "workspace_id", "report_id", "actor_user_id", "from_status", "to_status", "note")
      SELECT
        ${statusEventId},
        ${workspaceId},
        ${reportId},
        ${actorUserId},
        ${fromStatus},
        ${toStatus},
        ${eventNote}
      FROM updated_report
    )
    ${noteCte}
    ${outboxCte}
    SELECT EXISTS (SELECT 1 FROM updated_report) AS "updated"
  `)

  return result.rows[0]?.updated === true
}

function assertCanCreateReportNoteKind({
  input,
  report,
  role,
  userId,
}: {
  input: CreateReportNoteInput
  report: ReportRow
  role: WorkspaceMemberRole
  userId: string
}) {
  if (
    (input.kind === "work_note" ||
      input.kind === "blocker" ||
      input.kind === "clarification_request") &&
    isAssignedImplementationMember(role, userId, report) &&
    canAssignedMemberCreateNote(report.status, input.kind)
  ) {
    return
  }

  if (
    isAssignedImplementationMember(role, userId, report) &&
    (input.kind === "work_note" ||
      input.kind === "blocker" ||
      input.kind === "clarification_request")
  ) {
    throw new ConflictError(
      `A ${input.kind.replace(/_/g, " ")} cannot be added while this report is ${report.status.replace(/_/g, " ")}.`
    )
  }

  if (
    (input.kind === "clarification" || input.kind === "review_note") &&
    canAdministerReports(role)
  ) {
    return
  }

  throw new ForbiddenError("You cannot add this type of note to the report.")
}

export async function getWorkspaceReportCount(workspaceId: string) {
  const [row] = await db
    .select({
      count: sql<number>`count(*)::int`.mapWith(Number),
    })
    .from(reports)
    .where(
      and(
        eq(reports.workspaceId, workspaceId),
        isNull(reports.archivedAt)
      )
    )

  return row?.count ?? 0
}

export async function getWorkspaceReportCounts(
  userId: string,
  workspaceSlug: string,
  input: ReportCountsInput = {}
) {
  const workspace = await requireWorkspaceForReportsRead(userId, workspaceSlug)
  const conditions = getReportBaseConditions(workspace.id, input, userId)
  const activeStatuses = sqlValues([...activeReportStatuses])
  const progressStatuses = sqlValues([...progressReportStatuses])
  const [row] = await db
    .select({
      all: sql<number>`count(*)::int`.mapWith(Number),
      assignedToMe:
        sql<number>`count(*) filter (
          where ${reports.assigneeUserId} = ${userId}
            and ${reports.status} in (${progressStatuses})
        )::int`.mapWith(Number),
      inProgress:
        sql<number>`count(*) filter (where ${reports.status} in (${progressStatuses}))::int`.mapWith(
          Number
        ),
      open:
        sql<number>`count(*) filter (where ${reports.status} in (${activeStatuses}))::int`.mapWith(
          Number
        ),
      reportedByMe:
        sql<number>`count(*) filter (where ${reports.reporterUserId} = ${userId})::int`.mapWith(
          Number
        ),
      resolved:
        sql<number>`count(*) filter (where ${reports.status} = 'resolved')::int`.mapWith(
          Number
        ),
    })
    .from(reports)
    .where(and(...conditions))

  return {
    workspace,
    counts: {
      all: row?.all ?? 0,
      assignedToMe: row?.assignedToMe ?? 0,
      inProgress: row?.inProgress ?? 0,
      open: row?.open ?? 0,
      reportedByMe: row?.reportedByMe ?? 0,
      resolved: row?.resolved ?? 0,
    },
  }
}

export async function listWorkspaceReports(
  userId: string,
  workspaceSlug: string,
  input: ListWorkspaceReportsServiceInput = {
    limit: 30,
    sort: "newest",
    status: "all",
  }
) {
  const workspace = await requireWorkspaceForReportsRead(userId, workspaceSlug)
  const offset = decodeReportsCursor(input.cursor)
  const conditions = getReportBaseConditions(workspace.id, input, userId)
  const statusCondition = getReportStatusCondition(
    input.status,
    input.exactStatus
  )

  if (statusCondition) {
    conditions.push(statusCondition)
  }

  const rows = await db
    .select(reportSelectFields())
    .from(reports)
    .where(and(...conditions))
    .orderBy(...getReportOrderBy(input.sort))
    .limit(input.limit + 1)
    .offset(offset)
  const pageRows = rows.slice(0, input.limit)
  const hasNextPage = rows.length > input.limit

  const [peopleById, pageAssetsByReportId, commentsCountByReportId] = await Promise.all([
    getPeopleById(
      compactUserIds(
        pageRows.flatMap((row) => [row.reporterUserId, row.assigneeUserId])
      )
    ),
    getPageScreenshotAssets(
      workspace.id,
      pageRows.map((row) => row.id)
    ),
    getReportCommentsCounts(
      workspace.id,
      pageRows.map((row) => row.id)
    ),
  ])

  return {
    workspace,
    reports: pageRows.map((row) => {
      const pageAsset = pageAssetsByReportId.get(row.id)
      return serializeReport(
        {
          ...row,
          commentsCount: commentsCountByReportId.get(row.id) ?? 0,
        },
        peopleById,
        pageAsset ? [pageAsset] : []
      )
    }),
    pageInfo: getReportsPageInfo({
      hasNextPage,
      limit: input.limit,
      offset,
      pageSize: pageRows.length,
    }),
  }
}

export async function listWorkspaceImplementationQueue(
  userId: string,
  workspaceSlug: string,
  input: {
    limit?: number
    status: WorkspaceImplementationQueueStatus
  }
) {
  return listWorkspaceReports(userId, workspaceSlug, {
    exactStatus: input.status,
    limit: Math.min(Math.max(input.limit ?? 20, 1), 50),
    scope: "assigned",
    sort: "priority_oldest",
    status: "all",
  })
}

export async function getNextWorkspaceImplementationReport(
  userId: string,
  workspaceSlug: string
) {
  const result = await listWorkspaceImplementationQueue(
    userId,
    workspaceSlug,
    { limit: 1, status: "assigned" }
  )

  return {
    report: result.reports[0] ?? null,
    workspace: result.workspace,
  }
}

async function getAssignableWorkspaceReportMembers(workspaceId: string) {
  const members = await db
    .select({
      displayName: userProfiles.displayName,
      email: users.email,
      fullName: userProfiles.fullName,
      role: workspaceMemberships.role,
      title: userProfiles.title,
      userId: workspaceMemberships.userId,
    })
    .from(workspaceMemberships)
    .innerJoin(users, eq(users.id, workspaceMemberships.userId))
    .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
    .where(
      and(
        eq(workspaceMemberships.workspaceId, workspaceId),
        eq(workspaceMemberships.status, "active"),
        inArray(workspaceMemberships.role, [...assignableReportRoles])
      )
    )
    .orderBy(asc(users.email))

  return members.flatMap((member) =>
    isAssignableReportRole(member.role)
      ? [
          {
            email: member.email,
            name:
              member.fullName?.trim() ||
              member.displayName?.trim() ||
              getNameFromEmail(member.email),
            role: member.role,
            title: member.title,
            userId: member.userId,
          },
        ]
      : []
  )
}

export async function listAssignableWorkspaceReportMembers(
  userId: string,
  workspaceSlug: string
) {
  const workspace = await requireWorkspaceForReportsRead(userId, workspaceSlug)

  assertCanWorkspaceRole(workspace.role, "report:assign")

  return {
    members: await getAssignableWorkspaceReportMembers(workspace.id),
    workspace,
  }
}

function assertBulkTaskMatchesExisting(
  task: ResolvedBulkTask,
  existing: {
    clientPayloadHash: string | null
  }
) {
  if (existing.clientPayloadHash !== task.payloadHash) {
    throw new ConflictError(
      `Client task id "${task.input.clientTaskId}" already belongs to a different report. Use a new client task id.`
    )
  }
}

function buildBulkTaskPayloadHash(
  task: BulkTaskInput,
  assigneeUserId: string | null,
  implementationBrief: ReturnType<
    typeof normalizeBulkTaskImplementationBrief
  >
) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        assigneeUserId,
        createdAt: task.createdAt ?? null,
        description: task.description,
        developerPrompt: task.developerPrompt ?? null,
        implementationBrief,
        severity: task.severity,
        summary: task.summary ?? null,
        title: task.title,
        type: task.type,
        url: task.url ?? null,
      })
    )
    .digest("hex")
}

function normalizeBulkTaskImplementationBrief(
  brief: BulkTaskInput["implementationBrief"]
) {
  if (!brief) {
    return null
  }

  const normalized = {
    acceptanceCriteria: brief.acceptanceCriteria ?? [],
    implementationNotes: brief.implementationNotes ?? null,
    constraintsNonGoals: brief.constraintsNonGoals ?? [],
    expectedBehavior: brief.expectedBehavior ?? null,
    referenceLinks: brief.referenceLinks ?? [],
    reviewChecklist: brief.reviewChecklist ?? [],
  }
  const hasContent =
    normalized.acceptanceCriteria.length > 0 ||
    Boolean(normalized.implementationNotes) ||
    normalized.constraintsNonGoals.length > 0 ||
    Boolean(normalized.expectedBehavior) ||
    normalized.referenceLinks.length > 0 ||
    normalized.reviewChecklist.length > 0

  return hasContent ? normalized : null
}

async function getBulkTaskByClientId(
  workspaceId: string,
  clientTaskId: string
) {
  const [row] = await db
    .select({
      assigneeUserId: reports.assigneeUserId,
      clientTaskId: reports.clientReportId,
      clientPayloadHash: reports.clientPayloadHash,
      reportId: reports.id,
      status: reports.status,
      title: reports.title,
    })
    .from(reports)
    .where(
      and(
        eq(reports.workspaceId, workspaceId),
        eq(reports.clientReportId, clientTaskId)
      )
    )
    .limit(1)

  return row ?? null
}

async function insertBulkTaskAtomic({
  actorUserId,
  task,
  workspaceId,
  workspaceSlug,
}: {
  actorUserId: string
  task: ResolvedBulkTask
  workspaceId: string
  workspaceSlug: string
}): Promise<BulkCreatedTask> {
  const reportId = randomUUID()
  const status: WorkspaceReportStatus = task.assigneeUserId
    ? "assigned"
    : "submitted"
  const statusEventId = randomUUID()
  const capturedAt = task.input.createdAt
    ? new Date(task.input.createdAt)
    : new Date()
  const summary =
    task.input.summary ?? truncateText(task.input.description, 500)
  const developerPrompt =
    task.input.developerPrompt ??
    [
      `Implement FeedMe task "${task.input.title}".`,
      task.url ? `Source URL: ${task.url}` : null,
      `Problem: ${task.input.description}`,
    ]
      .filter((line): line is string => line !== null)
      .join("\n")
  const outboxValues = task.assigneeUserId
    ? buildNotificationOutboxValues({
        workspaceId,
        recipientUserIds: [task.assigneeUserId],
        actorUserId,
        reportId,
        type: "report_assigned",
        title: "Task assigned to you",
        body: truncateNotificationBody(task.input.title),
        href: getReportNotificationHref(workspaceSlug, reportId),
        dedupeKey: `bulk-task-assigned:${task.input.clientTaskId}`,
      })
    : null
  const briefCte = task.implementationBrief
    ? sql`, inserted_brief AS (
        INSERT INTO ${reportImplementationBriefs} (
          "workspace_id",
          "report_id",
          "acceptance_criteria",
          "implementation_notes",
          "constraints_non_goals",
          "expected_behavior",
          "reference_links",
          "review_checklist",
          "updated_by_user_id"
        )
        SELECT
          ${workspaceId},
          "id",
          CAST(${JSON.stringify(task.implementationBrief.acceptanceCriteria)} AS jsonb),
          ${task.implementationBrief.implementationNotes},
          CAST(${JSON.stringify(task.implementationBrief.constraintsNonGoals)} AS jsonb),
          ${task.implementationBrief.expectedBehavior},
          CAST(${JSON.stringify(task.implementationBrief.referenceLinks)} AS jsonb),
          CAST(${JSON.stringify(task.implementationBrief.reviewChecklist)} AS jsonb),
          ${actorUserId}
        FROM inserted_report
      )`
    : sql``
  const outboxCte = outboxValues
    ? sql`, queued_notification AS (
        INSERT INTO ${notificationOutbox} (
          "id",
          "workspace_id",
          "dedupe_key",
          "payload"
        )
        SELECT
          ${outboxValues.id},
          ${outboxValues.workspaceId},
          ${outboxValues.dedupeKey},
          CAST(${JSON.stringify(outboxValues.payload)} AS jsonb)
        FROM inserted_report
        ON CONFLICT ("workspace_id", "dedupe_key") DO NOTHING
      )`
    : sql``
  const result = await db.execute<{ id: string }>(sql`
    WITH eligible_assignee AS MATERIALIZED (
      SELECT "user_id"
      FROM ${workspaceMemberships}
      WHERE "workspace_id" = ${workspaceId}
        AND "user_id" = CAST(${task.assigneeUserId} AS uuid)
        AND "status" = 'active'::membership_status
        AND "role" IN ('developer'::workspace_role, 'designer'::workspace_role)
      FOR UPDATE
    ),
    inserted_report AS (
      INSERT INTO ${reports} (
        "id",
        "workspace_id",
        "client_report_id",
        "client_payload_hash",
        "title",
        "summary",
        "severity",
        "status",
        "type",
        "source",
        "domain",
        "url",
        "browser",
        "device",
        "viewport",
        "selected_element",
        "feedback_message",
        "developer_prompt",
        "reporter_user_id",
        "assignee_user_id",
        "captured_at"
      )
      SELECT
        ${reportId},
        ${workspaceId},
        ${task.input.clientTaskId},
        ${task.payloadHash},
        ${task.input.title},
        ${summary},
        CAST(${task.input.severity} AS report_severity),
        CAST(${status} AS report_status),
        CAST(${task.input.type} AS report_type),
        'task'::report_source,
        NULL,
        ${task.url},
        NULL,
        NULL,
        NULL,
        NULL,
        ${task.input.description},
        ${developerPrompt},
        ${actorUserId},
        ${task.assigneeUserId},
        ${capturedAt}
      WHERE CAST(${task.assigneeUserId} AS uuid) IS NULL
        OR EXISTS (SELECT 1 FROM eligible_assignee)
      ON CONFLICT ("workspace_id", "client_report_id") DO NOTHING
      RETURNING "id"
    ),
    inserted_event AS (
      INSERT INTO ${reportStatusEvents} (
        "id",
        "workspace_id",
        "report_id",
        "actor_user_id",
        "from_status",
        "to_status",
        "note"
      )
      SELECT
        ${statusEventId},
        ${workspaceId},
        "id",
        ${actorUserId},
        NULL,
        CAST(${status} AS report_status),
        ${task.assigneeUserId
          ? "Task created through MCP and assigned."
          : "Task created through MCP."}
      FROM inserted_report
    )
    ${briefCte}
    ${outboxCte}
    SELECT "id" FROM inserted_report
  `)

  if (result.rows[0]?.id) {
    if (outboxValues?.id) {
      await processNotificationOutboxEvent(outboxValues.id as string)
    }

    return {
      assigneeUserId: task.assigneeUserId,
      clientTaskId: task.input.clientTaskId,
      created: true,
      reportId,
      status,
      title: task.input.title,
    }
  }

  const existing = await getBulkTaskByClientId(
    workspaceId,
    task.input.clientTaskId
  )

  if (!existing) {
    throw new ConflictError(
      `Task "${task.input.clientTaskId}" could not be committed atomically. Retry the same request.`
    )
  }

  assertBulkTaskMatchesExisting(task, existing)

  return {
    assigneeUserId: existing.assigneeUserId,
    clientTaskId: task.input.clientTaskId,
    created: false,
    reportId: existing.reportId,
    status: existing.status,
    title: existing.title,
  }
}

export async function bulkCreateWorkspaceTasks(
  userId: string,
  workspaceSlug: string,
  input: BulkCreateTasksInput
) {
  const workspace = await requireWorkspaceForReportCreate(userId, workspaceSlug)
  const needsAssignment = input.tasks.some((task) => task.assignee)
  const needsBrief = input.tasks.some(
    (task) => normalizeBulkTaskImplementationBrief(task.implementationBrief) !== null
  )

  if (needsAssignment) {
    assertCanWorkspaceRole(workspace.role, "report:assign")
  }

  if (needsBrief) {
    assertCanWorkspaceRole(workspace.role, "report:update_brief")
  }

  const assignableMembers = needsAssignment
    ? await getAssignableWorkspaceReportMembers(workspace.id)
    : []
  const memberById = new Map(
    assignableMembers.map((member) => [member.userId, member])
  )
  const memberByEmail = new Map(
    assignableMembers.map((member) => [member.email.toLowerCase(), member])
  )
  const resolvedTasks: ResolvedBulkTask[] = input.tasks.map((task, index) => {
    const implementationBrief = normalizeBulkTaskImplementationBrief(
      task.implementationBrief
    )
    const member = task.assignee?.userId
      ? memberById.get(task.assignee.userId)
      : task.assignee?.email
        ? memberByEmail.get(task.assignee.email.toLowerCase())
        : undefined

    if (task.assignee && !member) {
      throw new ValidationError(
        `Task ${index + 1} has an invalid assignee.`,
        {
          [`tasks.${index}.assignee`]: [
            "Choose an active developer or designer in this workspace.",
          ],
        }
      )
    }

    return {
      assigneeUserId: member?.userId ?? null,
      implementationBrief,
      input: task,
      payloadHash: buildBulkTaskPayloadHash(
        task,
        member?.userId ?? null,
        implementationBrief
      ),
      url: task.url ?? null,
    }
  })
  const existingRows = await db
    .select({
      assigneeUserId: reports.assigneeUserId,
      clientTaskId: reports.clientReportId,
      clientPayloadHash: reports.clientPayloadHash,
      reportId: reports.id,
      status: reports.status,
      title: reports.title,
    })
    .from(reports)
    .where(
      and(
        eq(reports.workspaceId, workspace.id),
        inArray(
          reports.clientReportId,
          resolvedTasks.map((task) => task.input.clientTaskId)
        )
      )
    )
  const existingByClientId = new Map(
    existingRows.flatMap((row) =>
      row.clientTaskId ? [[row.clientTaskId, row] as const] : []
    )
  )
  const resultsByClientId = new Map<string, BulkCreatedTask>()
  const newTasks: ResolvedBulkTask[] = []

  for (const task of resolvedTasks) {
    const existing = existingByClientId.get(task.input.clientTaskId)

    if (!existing) {
      newTasks.push(task)
      continue
    }

    assertBulkTaskMatchesExisting(task, existing)
    resultsByClientId.set(task.input.clientTaskId, {
      assigneeUserId: existing.assigneeUserId,
      clientTaskId: task.input.clientTaskId,
      created: false,
      reportId: existing.reportId,
      status: existing.status,
      title: existing.title,
    })
  }

  const createdTasks = await Promise.all(
    newTasks.map((task) =>
      insertBulkTaskAtomic({
        actorUserId: userId,
        task,
        workspaceId: workspace.id,
        workspaceSlug,
      })
    )
  )

  for (const task of createdTasks) {
    resultsByClientId.set(task.clientTaskId, task)
  }

  return {
    createdCount: createdTasks.filter((task) => task.created).length,
    existingCount:
      input.tasks.length -
      createdTasks.filter((task) => task.created).length,
    tasks: input.tasks.map(
      (task) => resultsByClientId.get(task.clientTaskId) as BulkCreatedTask
    ),
  }
}

export async function createWorkspaceReport(
  userId: string,
  workspaceSlug: string,
  input: CreateReportInput
) {
  const workspace = await requireWorkspaceForReportCreate(userId, workspaceSlug)
  const domain = normalizeDomainHost(input.url, "url")

  await assertWorkspaceAllowsReportDomain(workspace.id, domain)

  const reportId = randomUUID()
  const clientReportId = input.clientReportId ?? null
  const capturedAt = parseCapturedAt(input)
  const reportValues = {
    id: reportId,
    workspaceId: workspace.id,
    clientReportId,
    title: buildReportTitle(input, domain),
    summary: buildReportSummary(input),
    severity: input.severity,
    status: "submitted",
    type: input.type,
    domain,
    url: input.url,
    browser: input.browser,
    device: input.device,
    viewport: input.viewport,
    selectedElement: input.selectedElement,
    feedbackMessage: input.feedbackMessage,
    developerPrompt: buildCreateDeveloperPrompt(input, domain),
    reporterUserId: userId,
    capturedAt,
  } satisfies typeof reports.$inferInsert

  const statusEventId = randomUUID()
  const assetRows = sql.join(
    input.assets.map(
      (asset) => sql`(
        CAST(${asset.type} AS report_asset_type),
        ${asset.url},
        ${asset.mimeType ?? null},
        CAST(${asset.width ?? null} AS integer),
        CAST(${asset.height ?? null} AS integer)
      )`
    ),
    sql`, `
  )
  const result = await db.execute<{ id: string }>(sql`
    WITH inserted_report AS (
      INSERT INTO ${reports} (
        "id",
        "workspace_id",
        "client_report_id",
        "title",
        "summary",
        "severity",
        "status",
        "type",
        "domain",
        "url",
        "browser",
        "device",
        "viewport",
        "selected_element",
        "feedback_message",
        "developer_prompt",
        "reporter_user_id",
        "captured_at"
      )
      VALUES (
        ${reportId},
        ${workspace.id},
        ${clientReportId},
        ${reportValues.title},
        ${reportValues.summary},
        CAST(${reportValues.severity} AS report_severity),
        'submitted'::report_status,
        CAST(${reportValues.type} AS report_type),
        ${reportValues.domain},
        ${reportValues.url},
        ${reportValues.browser ?? null},
        ${reportValues.device ?? null},
        CAST(${JSON.stringify(reportValues.viewport)} AS jsonb),
        CAST(${JSON.stringify(reportValues.selectedElement)} AS jsonb),
        ${reportValues.feedbackMessage},
        ${reportValues.developerPrompt ?? null},
        ${userId},
        ${capturedAt}
      )
      ON CONFLICT ("workspace_id", "client_report_id") DO NOTHING
      RETURNING "id"
    ),
    inserted_status_event AS (
      INSERT INTO ${reportStatusEvents} (
        "id",
        "workspace_id",
        "report_id",
        "actor_user_id",
        "from_status",
        "to_status",
        "note"
      )
      SELECT
        ${statusEventId},
        ${workspace.id},
        "id",
        ${userId},
        NULL,
        'submitted'::report_status,
        'Report submitted.'
      FROM inserted_report
    ),
    inserted_assets AS (
      INSERT INTO ${reportAssets} (
        "workspace_id",
        "report_id",
        "type",
        "url",
        "mime_type",
        "width",
        "height"
      )
      SELECT
        ${workspace.id},
        inserted_report."id",
        asset."type",
        asset."url",
        asset."mime_type",
        asset."width",
        asset."height"
      FROM inserted_report
      CROSS JOIN (
        VALUES ${assetRows}
      ) AS asset("type", "url", "mime_type", "width", "height")
    )
    SELECT "id" FROM inserted_report
  `)
  const insertedReportId = result.rows[0]?.id

  if (insertedReportId) {
    return getWorkspaceReport(userId, workspaceSlug, insertedReportId)
  }

  if (clientReportId) {
    const existingReportId = await getReportIdByClientReportId(
      workspace.id,
      clientReportId
    )

    if (existingReportId) {
      return getWorkspaceReport(userId, workspaceSlug, existingReportId)
    }
  }

  throw new ConflictError(
    "This report could not be committed atomically. Refresh and try again."
  )
}

export async function assignWorkspaceReport(
  userId: string,
  workspaceSlug: string,
  reportId: string,
  input: AssignReportInput
) {
  const workspace = await requireWorkspaceForReportAssign(userId, workspaceSlug)
  const row = await getMutableReportRow(workspace.id, reportId)
  const nextAssigneeUserId = input.assigneeUserId
  const didChangeAssignee = row.assigneeUserId !== nextAssigneeUserId

  if (didChangeAssignee && isWorkspaceReportAssignmentLocked(row.status)) {
    throw new ValidationError("Assignment is locked after work starts.", {
      assigneeUserId: [
        "This report is already in progress, ready for review, resolved, or archived. Use an explicit override flow if ownership needs to change.",
      ],
    })
  }

  if (nextAssigneeUserId) {
    await assertAssignableReportMember(workspace.id, nextAssigneeUserId)
  }

  const nextStatus = getAssignmentStatus(
    row.status,
    nextAssigneeUserId,
    didChangeAssignee
  )
  const didChangeStatus = nextStatus !== row.status

  if (!didChangeAssignee && !didChangeStatus && !input.note) {
    return getWorkspaceReport(userId, workspaceSlug, reportId)
  }

  const note =
    input.note ??
    (nextAssigneeUserId ? "Report assigned." : "Report unassigned.")
  const statusEventId = randomUUID()
  const now = new Date()
  const outboxValues =
    didChangeAssignee && nextAssigneeUserId
      ? buildNotificationOutboxValues({
          workspaceId: workspace.id,
          recipientUserIds: [nextAssigneeUserId],
          actorUserId: userId,
          reportId,
          type: "report_assigned",
          title: "Report assigned to you",
          body: truncateNotificationBody(row.title),
          href: getReportNotificationHref(workspaceSlug, reportId),
          dedupeKey: `report-assigned:${statusEventId}`,
        })
      : null
  const outboxCte = outboxValues
    ? sql`, queued_notification AS (
        INSERT INTO ${notificationOutbox} (
          "id",
          "workspace_id",
          "dedupe_key",
          "payload"
        )
        SELECT
          ${outboxValues.id},
          ${outboxValues.workspaceId},
          ${outboxValues.dedupeKey},
          CAST(${JSON.stringify(outboxValues.payload)} AS jsonb)
        FROM updated_report
        ON CONFLICT ("workspace_id", "dedupe_key") DO NOTHING
      )`
    : sql``
  const updateResult = await db.execute<{ id: string }>(sql`
    WITH eligible_assignee AS MATERIALIZED (
      SELECT "user_id"
      FROM ${workspaceMemberships}
      WHERE "workspace_id" = ${workspace.id}
        AND "user_id" = CAST(${nextAssigneeUserId} AS uuid)
        AND "status" = 'active'::membership_status
        AND "role" IN ('developer'::workspace_role, 'designer'::workspace_role)
      FOR UPDATE
    ),
    updated_report AS (
      UPDATE ${reports}
      SET
        "assignee_user_id" = ${nextAssigneeUserId},
        "status" = CAST(${nextStatus} AS report_status),
        "resolved_at" = CASE
          WHEN ${didChangeStatus} THEN ${getResolvedAtForStatus(nextStatus)}
          ELSE "resolved_at"
        END,
        "updated_at" = ${now}
      WHERE "workspace_id" = ${workspace.id}
        AND "id" = ${reportId}
        AND "status" = CAST(${row.status} AS report_status)
        AND "assignee_user_id" IS NOT DISTINCT FROM ${row.assigneeUserId}
        AND (
          CAST(${nextAssigneeUserId} AS uuid) IS NULL
          OR EXISTS (SELECT 1 FROM eligible_assignee)
        )
      RETURNING "id"
    ),
    inserted_event AS (
      INSERT INTO ${reportStatusEvents} (
        "id",
        "workspace_id",
        "report_id",
        "actor_user_id",
        "from_status",
        "to_status",
        "note"
      )
      SELECT
        ${statusEventId},
        ${workspace.id},
        ${reportId},
        ${userId},
        CAST(${row.status} AS report_status),
        CAST(${nextStatus} AS report_status),
        ${note}
      FROM updated_report
    )
    ${outboxCte}
    SELECT "id" FROM updated_report
  `)

  if (!updateResult.rows[0]) {
    throw new ConflictError(
      "This report changed before the assignment was applied. Refresh and try again."
    )
  }

  if (outboxValues?.id) {
    await processNotificationOutboxEvent(outboxValues.id)
  }

  return getWorkspaceReport(userId, workspaceSlug, reportId)
}

export async function updateWorkspaceReportStatus(
  userId: string,
  workspaceSlug: string,
  reportId: string,
  input: UpdateReportStatusInput
) {
  const workspace = await requireWorkspaceForReportStatusUpdate(
    userId,
    workspaceSlug,
    input.status
  )
  const row = await getMutableReportRow(workspace.id, reportId)
  const isReportAdmin = canAdministerReports(workspace.role)
  const isAssignedMember = isAssignedImplementationMember(
    workspace.role,
    userId,
    row
  )

  if (!isReportAdmin) {
    if (!isAssignedMember && !isAssignableReportRole(workspace.role)) {
      throw new ForbiddenError()
    }

    if (!isAssignedMember) {
      throw new ForbiddenError("Only the assigned teammate can update this report.")
    }

  }

  if (row.status === input.status) {
    return getWorkspaceReport(userId, workspaceSlug, reportId)
  }

  if (!isReportAdmin && !canAssignedMemberTransition(row.status, input.status)) {
    throw new ConflictError(
      `This report cannot move from ${row.status.replace(/_/g, " ")} to ${input.status.replace(/_/g, " ")}. Refresh its context before continuing.`
    )
  }

  if (statusRequiresAssignee.has(input.status) && !row.assigneeUserId) {
    throw new ValidationError(
      "Assign a developer or designer before moving this report forward.",
      {
        status: ["A developer or designer assignee is required for this status."],
      }
    )
  }

  const statusEventId = randomUUID()
  let statusOutboxValues: typeof notificationOutbox.$inferInsert | null = null

  if (input.status === "ready_for_review") {
    const adminUserIds = await getActiveWorkspaceUserIdsByRoles(
      workspace.id,
      ["owner", "admin"],
      [userId]
    )

    statusOutboxValues = buildNotificationOutboxValues({
      workspaceId: workspace.id,
      recipientUserIds: adminUserIds,
      actorUserId: userId,
      reportId,
      type: "ready_for_review",
      title: "Report ready for review",
      body: truncateNotificationBody(row.title),
      href: getReportNotificationHref(workspaceSlug, reportId, "activity"),
      dedupeKey: `ready-for-review:${statusEventId}`,
    })
  }

  if (input.status === "resolved") {
    statusOutboxValues = buildNotificationOutboxValues({
      workspaceId: workspace.id,
      recipientUserIds: [row.assigneeUserId, row.reporterUserId].filter(
        Boolean
      ) as string[],
      actorUserId: userId,
      reportId,
      type: "report_resolved",
      title: "Report resolved",
      body: truncateNotificationBody(row.title),
      href: getReportNotificationHref(workspaceSlug, reportId),
      dedupeKey: `report-resolved:${statusEventId}`,
    })
  }

  const didUpdate = await applyReportStatusTransitionAtomic({
    actorUserId: userId,
    fromStatus: row.status,
    note: input.note,
    outboxValues: statusOutboxValues,
    reportId,
    statusEventId,
    toStatus: input.status,
    workspaceId: workspace.id,
  })

  if (!didUpdate) {
    throw new ConflictError(
      "This report changed before the update was applied. Refresh its context and try again."
    )
  }

  if (statusOutboxValues?.id) {
    await processNotificationOutboxEvent(statusOutboxValues.id)
  }

  return getWorkspaceReport(userId, workspaceSlug, reportId)
}

export async function createWorkspaceReportNote(
  userId: string,
  workspaceSlug: string,
  reportId: string,
  input: CreateReportNoteInput
) {
  const workspace = await requireWorkspaceForReportNote(userId, workspaceSlug)
  const row = await getMutableReportRow(workspace.id, reportId)

  assertCanCreateReportNoteKind({
    input,
    report: row,
    role: workspace.role,
    userId,
  })

  const noteId = randomUUID()
  let notificationInput: DurableWorkspaceNotificationInput | null = null
  if (input.kind === "clarification" && row.assigneeUserId) {
    notificationInput = {
      workspaceId: workspace.id,
      recipientUserIds: [row.assigneeUserId],
      actorUserId: userId,
      reportId,
      noteId,
      type: "clarification_added",
      title: "Clarification added",
      body: truncateNotificationBody(input.body),
      href: getReportNotificationHref(workspaceSlug, reportId, "activity"),
      dedupeKey: `clarification:${noteId}`,
    }
  }

  if (input.kind === "clarification_request") {
    const adminUserIds = await getActiveWorkspaceUserIdsByRoles(
      workspace.id,
      ["owner", "admin"],
      [userId]
    )
    const recipientUserIds = [
      ...adminUserIds,
      ...(row.reporterUserId ? [row.reporterUserId] : []),
    ]

    notificationInput = {
      workspaceId: workspace.id,
      recipientUserIds,
      actorUserId: userId,
      reportId,
      noteId,
      type: "clarification_requested",
      title: "Clarification requested",
      body: truncateNotificationBody(input.body),
      href: getReportNotificationHref(workspaceSlug, reportId, "activity"),
      dedupeKey: `clarification-request:${noteId}`,
    }
  }

  if (input.kind === "blocker") {
    const adminUserIds = await getActiveWorkspaceUserIdsByRoles(
      workspace.id,
      ["owner", "admin"],
      [userId]
    )

    notificationInput = {
      workspaceId: workspace.id,
      recipientUserIds: adminUserIds,
      actorUserId: userId,
      reportId,
      noteId,
      type: "blocker_added",
      title: "Blocker added",
      body: truncateNotificationBody(input.body),
      href: getReportNotificationHref(workspaceSlug, reportId, "activity"),
      dedupeKey: `blocker:${noteId}`,
    }
  }

  const outboxValues = notificationInput
    ? buildNotificationOutboxValues(notificationInput)
    : null
  const outboxCte = outboxValues
    ? sql`, queued_notification AS (
        INSERT INTO ${notificationOutbox} ("id", "workspace_id", "dedupe_key", "payload")
        SELECT
          ${outboxValues.id},
          ${outboxValues.workspaceId},
          ${outboxValues.dedupeKey},
          CAST(${JSON.stringify(outboxValues.payload)} AS jsonb)
        FROM inserted_note
        ON CONFLICT ("workspace_id", "dedupe_key") DO NOTHING
      )`
    : sql.empty()
  const insertedNote = await db.execute<{ id: string }>(sql`
    WITH inserted_note AS (
      INSERT INTO ${reportNotes}
        ("id", "workspace_id", "report_id", "author_user_id", "kind", "body")
      SELECT
        ${noteId},
        ${workspace.id},
        ${reportId},
        ${userId},
        CAST(${input.kind} AS report_note_kind),
        ${input.body}
      FROM ${reports}
      WHERE "workspace_id" = ${workspace.id}
        AND "id" = ${reportId}
        AND "status" = CAST(${row.status} AS report_status)
        AND "archived_at" IS NULL
        AND (
          ${!assignedMemberNoteKinds.has(input.kind)}
          OR "assignee_user_id" = ${userId}
        )
      RETURNING "id"
    )
    ${outboxCte}
    SELECT "id" FROM inserted_note
  `)

  if (!insertedNote.rows[0]) {
    throw new ConflictError(
      "This report changed before the note was saved. Refresh its context and try again."
    )
  }

  const notificationDelivery = outboxValues?.id
    ? (await processNotificationOutboxEvent(outboxValues.id))
      ? "delivered" as const
      : "queued" as const
    : "not_required" as const

  return {
    ...(await getWorkspaceReport(userId, workspaceSlug, reportId)),
    notificationDelivery,
  }
}

async function assertReportCommentParent(
  workspaceId: string,
  reportId: string,
  parentCommentId?: string | null
) {
  if (!parentCommentId) {
    return
  }

  const [parent] = await db
    .select({ id: reportComments.id })
    .from(reportComments)
    .where(
      and(
        eq(reportComments.workspaceId, workspaceId),
        eq(reportComments.reportId, reportId),
        eq(reportComments.id, parentCommentId),
        isNull(reportComments.deletedAt)
      )
    )
    .limit(1)

  if (!parent) {
    throw new ValidationError("Parent comment not found.", {
      parentCommentId: ["Choose an existing comment on this report."],
    })
  }
}

async function getReportCommentParentForCreate(
  workspaceId: string,
  reportId: string,
  parentCommentId?: string | null
) {
  if (!parentCommentId) {
    return null
  }

  const [parent] = await db
    .select({
      authorUserId: reportComments.authorUserId,
      id: reportComments.id,
    })
    .from(reportComments)
    .where(
      and(
        eq(reportComments.workspaceId, workspaceId),
        eq(reportComments.reportId, reportId),
        eq(reportComments.id, parentCommentId),
        isNull(reportComments.deletedAt)
      )
    )
    .limit(1)

  if (!parent) {
    throw new ValidationError("Parent comment not found.", {
      parentCommentId: ["Choose an existing comment on this report."],
    })
  }

  return parent
}

async function getActiveMentionedUserIds(
  workspaceId: string,
  mentionedUserIds: string[] = []
) {
  const uniqueMentionedUserIds = [...new Set(mentionedUserIds)]

  if (uniqueMentionedUserIds.length === 0) {
    return []
  }

  const rows = await db
    .select({ userId: workspaceMemberships.userId })
    .from(workspaceMemberships)
    .where(
      and(
        eq(workspaceMemberships.workspaceId, workspaceId),
        eq(workspaceMemberships.status, "active"),
        inArray(workspaceMemberships.userId, uniqueMentionedUserIds)
      )
    )
  const activeMentionedUserIds = rows.map((row) => row.userId)

  if (activeMentionedUserIds.length !== uniqueMentionedUserIds.length) {
    throw new ValidationError("Choose active teammates in this workspace.", {
      mentionedUserIds: ["One or more mentioned teammates are not active."],
    })
  }

  return activeMentionedUserIds
}

async function buildReportCommentMutationResponse({
  comment,
  reportId,
  userId,
  workspaceId,
}: {
  comment: Omit<ReportCommentRow, "mentions" | "reactions" | "replyCount">
  reportId: string
  userId: string
  workspaceId: string
}) {
  const [[hydratedComment], commentsCount] = await Promise.all([
    withCommentMetadata(workspaceId, reportId, userId, [comment]),
    getReportCommentsCount(workspaceId, reportId),
  ])

  if (!hydratedComment) {
    throw new Error("Failed to hydrate report comment.")
  }

  const peopleById = await getPeopleById(
    compactUserIds([hydratedComment.authorUserId])
  )

  return {
    report: { id: reportId, commentsCount },
    comment: serializeReportComment(hydratedComment, peopleById),
  }
}

async function getCommentByClientMutationId(
  workspaceId: string,
  reportId: string,
  clientMutationId: string
) {
  const [comment] = await db
    .select(reportCommentSelectFields())
    .from(reportComments)
    .where(
      and(
        eq(reportComments.workspaceId, workspaceId),
        eq(reportComments.reportId, reportId),
        eq(reportComments.clientMutationId, clientMutationId)
      )
    )
    .limit(1)

  return comment ?? null
}

export async function createWorkspaceReportComment(
  userId: string,
  workspaceSlug: string,
  reportId: string,
  input: CreateReportCommentInput
) {
  const workspace = await requireWorkspaceForReportNote(userId, workspaceSlug)

  const row = await getMutableReportRow(workspace.id, reportId)
  const existingComment = await getCommentByClientMutationId(
    workspace.id,
    reportId,
    input.clientMutationId
  )

  if (existingComment) {
    return buildReportCommentMutationResponse({
      comment: existingComment,
      reportId,
      userId,
      workspaceId: workspace.id,
    })
  }

  const [parentComment, mentionedUserIds] = await Promise.all([
    getReportCommentParentForCreate(
      workspace.id,
      reportId,
      input.parentCommentId
    ),
    getActiveMentionedUserIds(workspace.id, input.mentionedUserIds),
  ])

  const commentId = randomUUID()
  const notifiedRecipientIds = new Set<string>()
  const commentHref = getReportNotificationHref(
    workspaceSlug,
    reportId,
    "comments",
    commentId
  )
  const commentBody = truncateNotificationBody(input.body)
  const notificationInputs: DurableWorkspaceNotificationInput[] = []

  if (mentionedUserIds.length > 0) {
    mentionedUserIds.forEach((mentionedUserId) =>
      notifiedRecipientIds.add(mentionedUserId)
    )
    notificationInputs.push({
        workspaceId: workspace.id,
        recipientUserIds: mentionedUserIds,
        actorUserId: userId,
        reportId,
        commentId,
        type: "comment_mention",
        title: "You were mentioned",
        body: commentBody,
        href: commentHref,
        dedupeKey: `comment-mention:${commentId}`,
      })
  }

  if (
    parentComment?.authorUserId &&
    !notifiedRecipientIds.has(parentComment.authorUserId)
  ) {
    notifiedRecipientIds.add(parentComment.authorUserId)
    notificationInputs.push({
        workspaceId: workspace.id,
        recipientUserIds: [parentComment.authorUserId],
        actorUserId: userId,
        reportId,
        commentId,
        type: "comment_reply",
        title: "New reply on your comment",
        body: commentBody,
        href: commentHref,
        dedupeKey: `comment-reply:${commentId}`,
      })
  }

  if (
    canAdministerReports(workspace.role) &&
    row.assigneeUserId &&
    !notifiedRecipientIds.has(row.assigneeUserId)
  ) {
    notificationInputs.push({
        workspaceId: workspace.id,
        recipientUserIds: [row.assigneeUserId],
        actorUserId: userId,
        reportId,
        commentId,
        type: "admin_comment_added",
        title: "Admin commented on your assigned report",
        body: commentBody,
        href: commentHref,
        dedupeKey: `admin-comment:${commentId}`,
      })
  }
  const outboxValues = notificationInputs
    .map(buildNotificationOutboxValues)
    .filter(
      (value): value is typeof notificationOutbox.$inferInsert => Boolean(value)
    )
  const commentInsert = db
    .insert(reportComments)
    .values({
      id: commentId,
      workspaceId: workspace.id,
      reportId,
      authorUserId: userId,
      parentCommentId: input.parentCommentId ?? null,
      clientMutationId: input.clientMutationId,
      body: input.body,
    })
    .returning(reportCommentSelectFields())
  const mentionInsert = mentionedUserIds.length
    ? db.insert(reportCommentMentions).values(
        mentionedUserIds.map((mentionedUserId) => ({
          workspaceId: workspace.id,
          reportId,
          commentId,
          mentionedUserId,
          createdByUserId: userId,
        }))
      )
    : db.execute(sql`SELECT 1`)
  const outboxInsert = outboxValues.length
    ? db
        .insert(notificationOutbox)
        .values(outboxValues)
        .onConflictDoNothing({
          target: [notificationOutbox.workspaceId, notificationOutbox.dedupeKey],
        })
    : db.execute(sql`SELECT 1`)
  let insertedComment:
    | Omit<ReportCommentRow, "mentions" | "reactions" | "replyCount">
    | null = null

  try {
    const [insertedRows] = await db.batch([
      commentInsert,
      mentionInsert,
      outboxInsert,
    ])
    insertedComment = insertedRows[0] ?? null
  } catch (error) {
    const errorCode = (error as { code?: string }).code

    if (errorCode !== "23505") {
      throw error
    }

    insertedComment = await getCommentByClientMutationId(
      workspace.id,
      reportId,
      input.clientMutationId
    )
  }

  if (!insertedComment) {
    throw new ConflictError(
      "This comment could not be committed atomically. Refresh and try again."
    )
  }

  await Promise.all(
    outboxValues.map((event) => processNotificationOutboxEvent(event.id as string))
  )

  return buildReportCommentMutationResponse({
    comment: insertedComment,
    reportId,
    userId,
    workspaceId: workspace.id,
  })
}

async function getReportCommentForView(
  workspaceId: string,
  reportId: string,
  commentId: string,
  userId: string
) {
  const [row] = await db
    .select({
      ...reportCommentSelectFields(),
    })
    .from(reportComments)
    .where(
      and(
        eq(reportComments.workspaceId, workspaceId),
        eq(reportComments.reportId, reportId),
        eq(reportComments.id, commentId)
      )
    )
    .limit(1)

  if (!row) {
    throw new NotFoundError("Comment not found.")
  }

  const [comment] = await withCommentMetadata(workspaceId, reportId, userId, [row])

  if (!comment) {
    throw new NotFoundError("Comment not found.")
  }

  return comment
}

function assertCanEditReportComment(
  userId: string,
  comment: ReportCommentRow
) {
  if (comment.deletedAt) {
    throw new ValidationError("Deleted comments cannot be edited.")
  }

  if (comment.authorUserId !== userId) {
    throw new ForbiddenError("Only the comment author can edit this comment.")
  }
}

function assertCanDeleteReportComment({
  comment,
  role,
  userId,
}: {
  comment: ReportCommentRow
  role: WorkspaceMemberRole
  userId: string
}) {
  if (comment.deletedAt) {
    throw new ValidationError("Comment is already deleted.")
  }

  if (comment.authorUserId === userId || canAdministerReports(role)) {
    return
  }

  throw new ForbiddenError("Only the author or an admin can delete this comment.")
}

export async function updateWorkspaceReportComment(
  userId: string,
  workspaceSlug: string,
  reportId: string,
  commentId: string,
  input: UpdateReportCommentInput
) {
  const workspace = await requireWorkspaceForReportNote(userId, workspaceSlug)

  await getMutableReportRow(workspace.id, reportId)
  const currentComment = await getReportCommentForView(
    workspace.id,
    reportId,
    commentId,
    userId
  )

  assertCanEditReportComment(userId, currentComment)

  const editedAt = new Date()
  const mentionedUserIds = input.mentionedUserIds
    ? await getActiveMentionedUserIds(workspace.id, input.mentionedUserIds)
    : null
  const outboxValues = mentionedUserIds?.length
    ? buildNotificationOutboxValues({
        workspaceId: workspace.id,
        recipientUserIds: mentionedUserIds,
        actorUserId: userId,
        reportId,
        commentId,
        type: "comment_mention",
        title: "You were mentioned",
        body: truncateNotificationBody(input.body),
        href: getReportNotificationHref(
          workspaceSlug,
          reportId,
          "comments",
          commentId
        ),
        dedupeKey: `comment-mention:${commentId}:${editedAt.getTime()}`,
      })
    : null
  const updateComment = db
    .update(reportComments)
    .set({
      body: input.body,
      editedAt,
    })
    .where(
      and(
        eq(reportComments.workspaceId, workspace.id),
        eq(reportComments.reportId, reportId),
        eq(reportComments.id, commentId),
        isNull(reportComments.deletedAt)
      )
    )
    .returning(reportCommentSelectFields())
  const deleteMentions = mentionedUserIds
    ? db
        .delete(reportCommentMentions)
        .where(
          and(
            eq(reportCommentMentions.workspaceId, workspace.id),
            eq(reportCommentMentions.reportId, reportId),
            eq(reportCommentMentions.commentId, commentId)
          )
        )
    : db.execute(sql`SELECT 1`)
  const insertMentions = mentionedUserIds?.length
    ? db.insert(reportCommentMentions).values(
        mentionedUserIds.map((mentionedUserId) => ({
          workspaceId: workspace.id,
          reportId,
          commentId,
          mentionedUserId,
          createdByUserId: userId,
        }))
      )
    : db.execute(sql`SELECT 1`)
  const insertOutbox = outboxValues
    ? db
        .insert(notificationOutbox)
        .values(outboxValues)
        .onConflictDoNothing({
          target: [notificationOutbox.workspaceId, notificationOutbox.dedupeKey],
        })
    : db.execute(sql`SELECT 1`)
  const [updatedRows] = await db.batch([
    updateComment,
    deleteMentions,
    insertMentions,
    insertOutbox,
  ])
  const updatedComment = updatedRows[0]

  if (!updatedComment) {
    throw new NotFoundError("Comment not found.")
  }

  if (outboxValues?.id) {
    await processNotificationOutboxEvent(outboxValues.id)
  }

  return buildReportCommentMutationResponse({
    comment: updatedComment,
    reportId,
    userId,
    workspaceId: workspace.id,
  })
}

export async function deleteWorkspaceReportComment(
  userId: string,
  workspaceSlug: string,
  reportId: string,
  commentId: string
) {
  const workspace = await requireWorkspaceForReportNote(userId, workspaceSlug)

  await getMutableReportRow(workspace.id, reportId)
  const currentComment = await getReportCommentForView(
    workspace.id,
    reportId,
    commentId,
    userId
  )

  assertCanDeleteReportComment({
    comment: currentComment,
    role: workspace.role,
    userId,
  })

  const deletedAt = new Date()
  const [deletedComment] = await db
    .update(reportComments)
    .set({
      deletedAt,
    })
    .where(
      and(
        eq(reportComments.workspaceId, workspace.id),
        eq(reportComments.reportId, reportId),
        eq(reportComments.id, commentId),
        isNull(reportComments.deletedAt)
      )
    )
    .returning(reportCommentSelectFields())

  if (!deletedComment) {
    throw new NotFoundError("Comment not found.")
  }

  const commentsCount = await getReportCommentsCount(workspace.id, reportId)
  const peopleById = await getPeopleById(
    compactUserIds([deletedComment.authorUserId])
  )
  const hydratedDeletedComment: ReportCommentRow = {
    ...deletedComment,
    mentions: currentComment.mentions,
    reactions: [],
    replyCount: currentComment.replyCount,
  }

  return {
    report: {
      id: reportId,
      commentsCount,
    },
    comment: serializeReportComment(hydratedDeletedComment, peopleById),
    removed: currentComment.replyCount === 0,
  }
}

export async function updateWorkspaceReportCommentReaction(
  userId: string,
  workspaceSlug: string,
  reportId: string,
  commentId: string,
  input: UpdateReportCommentReactionInput
) {
  const workspace = await requireWorkspaceForReportNote(userId, workspaceSlug)

  await getMutableReportRow(workspace.id, reportId)
  const currentComment = await getReportCommentForView(
    workspace.id,
    reportId,
    commentId,
    userId
  )

  if (currentComment.deletedAt) {
    throw new ValidationError("Deleted comments cannot receive reactions.")
  }

  if (input.enabled) {
    await db
      .insert(reportCommentReactions)
      .values({
        workspaceId: workspace.id,
        reportId,
        commentId,
        userId,
        reaction: input.reaction,
      })
      .onConflictDoNothing({
        target: [
          reportCommentReactions.commentId,
          reportCommentReactions.userId,
          reportCommentReactions.reaction,
        ],
      })
  } else {
    await db
      .delete(reportCommentReactions)
      .where(
        and(
          eq(reportCommentReactions.workspaceId, workspace.id),
          eq(reportCommentReactions.reportId, reportId),
          eq(reportCommentReactions.commentId, commentId),
          eq(reportCommentReactions.userId, userId),
          eq(reportCommentReactions.reaction, input.reaction)
        )
      )
  }

  const updatedComment = await getReportCommentForView(
    workspace.id,
    reportId,
    commentId,
    userId
  )
  const reportResult = await getWorkspaceReport(userId, workspaceSlug, reportId)
  const peopleById = await getPeopleById(
    compactUserIds([updatedComment.authorUserId])
  )

  return {
    ...reportResult,
    comment: serializeReportComment(updatedComment, peopleById),
  }
}

export async function listWorkspaceReportComments(
  userId: string,
  workspaceSlug: string,
  reportId: string,
  input: ListReportCommentsInput = {
    limit: defaultReportCommentsPageSize,
  }
) {
  const workspace = await requireWorkspaceForReportsRead(userId, workspaceSlug)

  await getMutableReportRow(workspace.id, reportId)
  await assertReportCommentParent(
    workspace.id,
    reportId,
    input.parentCommentId
  )

  const { rows, pageInfo } = await getCommentRowsForReportPage(
    workspace.id,
    reportId,
    userId,
    input
  )
  const peopleById = await getPeopleById(
    compactUserIds(rows.map((comment) => comment.authorUserId))
  )

  return {
    comments: serializeReportComments(rows, peopleById),
    pageInfo,
  }
}

export async function updateWorkspaceReportImplementationBrief(
  userId: string,
  workspaceSlug: string,
  reportId: string,
  input: UpdateReportImplementationBriefInput
) {
  const workspace = await requireWorkspaceForReportBriefUpdate(
    userId,
    workspaceSlug
  )

  await getMutableReportRow(workspace.id, reportId)

  const now = new Date()

  await db
    .insert(reportImplementationBriefs)
    .values({
      workspaceId: workspace.id,
      reportId,
      acceptanceCriteria: input.acceptanceCriteria,
      implementationNotes: input.implementationNotes ?? null,
      constraintsNonGoals: input.constraintsNonGoals,
      expectedBehavior: input.expectedBehavior ?? null,
      referenceLinks: input.referenceLinks,
      reviewChecklist: input.reviewChecklist,
      updatedByUserId: userId,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [
        reportImplementationBriefs.workspaceId,
        reportImplementationBriefs.reportId,
      ],
      set: {
        acceptanceCriteria: input.acceptanceCriteria,
        implementationNotes: input.implementationNotes ?? null,
        constraintsNonGoals: input.constraintsNonGoals,
        expectedBehavior: input.expectedBehavior ?? null,
        referenceLinks: input.referenceLinks,
        reviewChecklist: input.reviewChecklist,
        updatedByUserId: userId,
        updatedAt: now,
      },
    })

  return getWorkspaceReport(userId, workspaceSlug, reportId)
}

export async function getWorkspaceReport(
  userId: string,
  workspaceSlug: string,
  reportId: string
) {
  const workspace = await requireWorkspaceForReportsRead(userId, workspaceSlug)
  const [row] = await db
    .select(reportSelectFields())
    .from(reports)
    .where(
      and(
        eq(reports.workspaceId, workspace.id),
        eq(reports.id, reportId),
        isNull(reports.archivedAt)
      )
    )
    .limit(1)

  if (!row) {
    throw new NotFoundError("Report not found.")
  }

  const [
    assets,
    implementationBriefRow,
    notes,
    commentsPage,
    statusEvents,
    commentsCount,
  ] = await Promise.all([
    getAssetsForReport(workspace.id, row.id),
    getImplementationBriefForReport(workspace.id, row.id),
    getNotesForReport(workspace.id, row.id),
    getCommentRowsForReportPage(workspace.id, row.id, userId),
    getStatusEventsForReport(workspace.id, row.id),
    getReportCommentsCount(workspace.id, row.id),
  ])
  const peopleById = await getPeopleById(
    compactUserIds([
      row.reporterUserId,
      row.assigneeUserId,
      implementationBriefRow?.updatedByUserId,
      ...notes.map((note) => note.authorUserId),
      ...commentsPage.rows.map((comment) => comment.authorUserId),
      ...statusEvents.map((event) => event.actorUserId),
    ])
  )
  const implementationBrief = serializeReportImplementationBrief(
    implementationBriefRow,
    peopleById
  )
  const activity = serializeReportActivity(notes, statusEvents, peopleById)
  const serializedComments = serializeReportComments(commentsPage.rows, peopleById)

  return {
    workspace,
    report: serializeReport(
      {
        ...row,
        commentsCount,
      },
      peopleById,
      assets,
      implementationBrief,
      activity,
      serializedComments,
      commentsPage.pageInfo
    ),
  }
}
