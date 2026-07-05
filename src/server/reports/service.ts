import { randomUUID } from "node:crypto"

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
  reportComments,
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
  activeReportStatuses,
  formatReportCapturedAgo,
  formatReportCapturedAt,
  progressReportStatuses,
  type WorkspaceReport,
  type WorkspaceReportSort,
  type WorkspaceReportStatus,
  type WorkspaceReportsPageInfo,
} from "@/lib/reports"
import { getInitialsFromName, getNameFromEmail } from "@/lib/team-members"
import { ForbiddenError, NotFoundError, ValidationError } from "@/server/http/errors"
import { assertCanWorkspaceRole } from "@/server/policies/can"
import { normalizeDomainHost } from "@/server/workspaces/domains"
import { getWorkspaceForUserBySlug } from "@/server/workspaces/service"
import type {
  AssignReportInput,
  CreateReportInput,
  ListReportsInput,
  UpdateReportStatusInput,
} from "@/server/reports/validation"

type ReportRow = {
  id: string
  title: string
  summary: string
  severity: WorkspaceReport["severity"]
  status: WorkspaceReport["status"]
  type: WorkspaceReport["type"]
  domain: string
  url: string
  browser: string | null
  device: string | null
  viewport: ReportViewport
  selectedElement: ReportSelectedElement
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

const developerMutableStatuses = new Set<WorkspaceReportStatus>([
  "in_progress",
  "ready_for_review",
])

const statusRequiresAssignee = new Set<WorkspaceReportStatus>([
  "assigned",
  "in_progress",
  "ready_for_review",
])

const statusResetsWhenUnassigned = new Set<WorkspaceReportStatus>([
  "assigned",
  "in_progress",
  "ready_for_review",
])

function canAdministerReports(role: string) {
  return role === "owner" || role === "admin"
}

function commentsCountSql() {
  return sql<number>`(
    select count(*)::int
    from ${reportComments}
    where ${reportComments.workspaceId} = ${reports.workspaceId}
      and ${reportComments.reportId} = ${reports.id}
      and ${reportComments.deletedAt} is null
  )`.mapWith(Number)
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

function getReportStatusCondition(status: ListReportsInput["status"]) {
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
    return eq(reports.assigneeUserId, userId)
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

function getReportOrderBy(sort: WorkspaceReportSort) {
  const newestFirst = [desc(reports.capturedAt), desc(reports.id)]

  if (sort === "oldest") {
    return [asc(reports.capturedAt), asc(reports.id)]
  }

  if (sort === "priority") {
    return [
      sql`case ${reports.severity}
        when 'urgent' then 0
        when 'high' then 1
        when 'medium' then 2
        else 3
      end asc`,
      ...newestFirst,
    ]
  }

  if (sort === "comments") {
    return [desc(commentsCountSql()), ...newestFirst]
  }

  return newestFirst
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

function formatViewport(viewport: ReportViewport) {
  return `${viewport.width} x ${viewport.height}`
}

function normalizeSelectedElement(
  selectedElement: ReportSelectedElement
): WorkspaceReport["selectedElement"] {
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
  assets: ReportAssetRow[] = []
): WorkspaceReport["screenshots"] {
  if (assets.length === 0) {
    return getDefaultScreenshots(reportId)
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

function buildDeveloperPrompt(row: ReportRow) {
  return (
    row.developerPrompt ??
    `Review ${row.url}. Feedback: ${row.feedbackMessage}`
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
  assets: ReportAssetRow[] = []
): WorkspaceReport {
  const reporter = row.reporterUserId
    ? peopleById.get(row.reporterUserId)
    : undefined
  const assignee = row.assigneeUserId
    ? peopleById.get(row.assigneeUserId)
    : undefined
  const reporterName = getPersonName(reporter, "Unknown reporter")
  const assigneeName = getPersonName(assignee, "Unassigned")

  return {
    id: row.id,
    reporterUserId: row.reporterUserId,
    assigneeUserId: row.assigneeUserId,
    title: row.title,
    summary: row.summary,
    severity: row.severity,
    status: row.status,
    type: row.type,
    domain: row.domain,
    url: row.url,
    browser: row.browser ?? "Unknown browser",
    device: row.device ?? "Unknown device",
    viewport: formatViewport(row.viewport),
    capturedAt: formatReportCapturedAt(row.capturedAt),
    capturedAtIso: row.capturedAt.toISOString(),
    capturedAgo: formatReportCapturedAgo(row.capturedAt),
    screenshots: getScreenshotsFromAssets(row.id, assets),
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

async function assertAssignableDeveloper(workspaceId: string, userId: string) {
  const [member] = await db
    .select({ id: workspaceMemberships.id })
    .from(workspaceMemberships)
    .where(
      and(
        eq(workspaceMemberships.workspaceId, workspaceId),
        eq(workspaceMemberships.userId, userId),
        eq(workspaceMemberships.role, "developer"),
        eq(workspaceMemberships.status, "active")
      )
    )
    .limit(1)

  if (!member) {
    throw new ValidationError("Reports can only be assigned to active developers.", {
      assigneeUserId: ["Choose an active developer in this workspace."],
    })
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

export async function listWorkspaceReports(
  userId: string,
  workspaceSlug: string,
  input: ListReportsInput = {
    limit: 30,
    sort: "newest",
    status: "all",
  }
) {
  const workspace = await requireWorkspaceForReportsRead(userId, workspaceSlug)
  const offset = decodeReportsCursor(input.cursor)
  const conditions: SQL[] = [
    eq(reports.workspaceId, workspace.id),
    isNull(reports.archivedAt),
  ]
  const statusCondition = getReportStatusCondition(input.status)
  const scopeCondition = getReportScopeCondition(input.scope, userId)
  const searchCondition = getReportSearchCondition(input.q)

  if (statusCondition) {
    conditions.push(statusCondition)
  }

  if (scopeCondition) {
    conditions.push(scopeCondition)
  }

  if (searchCondition) {
    conditions.push(searchCondition)
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

  const peopleById = await getPeopleById(
    compactUserIds(
      pageRows.flatMap((row) => [row.reporterUserId, row.assigneeUserId])
    )
  )

  return {
    workspace,
    reports: pageRows.map((row) => serializeReport(row, peopleById)),
    pageInfo: getReportsPageInfo({
      hasNextPage,
      limit: input.limit,
      offset,
      pageSize: pageRows.length,
    }),
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
  const capturedAt = parseCapturedAt(input)
  const reportInsert = db.insert(reports).values({
    id: reportId,
    workspaceId: workspace.id,
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
  })
  const statusEventInsert = db.insert(reportStatusEvents).values({
    workspaceId: workspace.id,
    reportId,
    actorUserId: userId,
    fromStatus: null,
    toStatus: "submitted",
    note: "Report submitted.",
  })

  if (input.assets.length > 0) {
    await db.batch([
      reportInsert,
      statusEventInsert,
      db.insert(reportAssets).values(
        input.assets.map((asset) => ({
          workspaceId: workspace.id,
          reportId,
          type: asset.type,
          url: asset.url,
          mimeType: asset.mimeType,
          width: asset.width,
          height: asset.height,
        }))
      ),
    ])
  } else {
    await db.batch([reportInsert, statusEventInsert])
  }

  return getWorkspaceReport(userId, workspaceSlug, reportId)
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

  if (nextAssigneeUserId) {
    await assertAssignableDeveloper(workspace.id, nextAssigneeUserId)
  }

  const didChangeAssignee = row.assigneeUserId !== nextAssigneeUserId
  const nextStatus = getAssignmentStatus(
    row.status,
    nextAssigneeUserId,
    didChangeAssignee
  )
  const didChangeStatus = nextStatus !== row.status

  if (!didChangeAssignee && !didChangeStatus && !input.note) {
    return getWorkspaceReport(userId, workspaceSlug, reportId)
  }

  const updateValues: Partial<typeof reports.$inferInsert> = {
    assigneeUserId: nextAssigneeUserId,
    status: nextStatus,
  }

  if (didChangeStatus) {
    updateValues.resolvedAt = getResolvedAtForStatus(nextStatus)
  }

  const note =
    input.note ??
    (nextAssigneeUserId
      ? "Report assigned to a developer."
      : "Report unassigned.")

  await db.batch([
    db
      .update(reports)
      .set(updateValues)
      .where(and(eq(reports.workspaceId, workspace.id), eq(reports.id, reportId))),
    db.insert(reportStatusEvents).values({
      workspaceId: workspace.id,
      reportId,
      actorUserId: userId,
      fromStatus: row.status,
      toStatus: nextStatus,
      note,
    }),
  ])

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

  if (!isReportAdmin) {
    if (workspace.role !== "developer") {
      throw new ForbiddenError()
    }

    if (row.assigneeUserId !== userId) {
      throw new ForbiddenError("Only the assigned developer can update this report.")
    }

    if (!developerMutableStatuses.has(input.status)) {
      throw new ForbiddenError("Developers can only start work or mark it ready.")
    }
  }

  if (statusRequiresAssignee.has(input.status) && !row.assigneeUserId) {
    throw new ValidationError("Assign a developer before moving this report forward.", {
      status: ["A developer assignee is required for this status."],
    })
  }

  if (row.status === input.status && !input.note) {
    return getWorkspaceReport(userId, workspaceSlug, reportId)
  }

  await db.batch([
    db
      .update(reports)
      .set({
        archivedAt: input.status === "archived" ? new Date() : null,
        status: input.status,
        resolvedAt: getResolvedAtForStatus(input.status),
      })
      .where(and(eq(reports.workspaceId, workspace.id), eq(reports.id, reportId))),
    db.insert(reportStatusEvents).values({
      workspaceId: workspace.id,
      reportId,
      actorUserId: userId,
      fromStatus: row.status,
      toStatus: input.status,
      note: input.note ?? `Status changed to ${input.status.replace(/_/g, " ")}.`,
    }),
  ])

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

  const [peopleById, assets] = await Promise.all([
    getPeopleById(compactUserIds([row.reporterUserId, row.assigneeUserId])),
    getAssetsForReport(workspace.id, row.id),
  ])

  return {
    workspace,
    report: serializeReport(row, peopleById, assets),
  }
}
