import { randomUUID } from "node:crypto"

import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm"

import { db } from "@/db"
import {
  reportAssets,
  reportComments,
  reportStatusEvents,
  reports,
  userProfiles,
  users,
  workspaceDomains,
  type ReportSelectedElement,
  type ReportViewport,
} from "@/db/schema"
import {
  formatReportCapturedAgo,
  formatReportCapturedAt,
  type WorkspaceReport,
} from "@/lib/reports"
import { getInitialsFromName, getNameFromEmail } from "@/lib/team-members"
import { NotFoundError, ValidationError } from "@/server/http/errors"
import { assertCanWorkspaceRole } from "@/server/policies/can"
import { normalizeDomainHost } from "@/server/workspaces/domains"
import { getWorkspaceForUserBySlug } from "@/server/workspaces/service"
import type { CreateReportInput } from "@/server/reports/validation"

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

function commentsCountSql() {
  return sql<number>`(
    select count(*)::int
    from ${reportComments}
    where ${reportComments.workspaceId} = ${reports.workspaceId}
      and ${reportComments.reportId} = ${reports.id}
      and ${reportComments.deletedAt} is null
  )`.mapWith(Number)
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
        width: asset.width,
        height: asset.height,
      }
    }

    return {
      id: asset.id,
      label: asset.type === "element_screenshot" ? "Element" : "Annotated",
      kind: "annotated",
      url: asset.url,
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

async function getAssetsByReportId(workspaceId: string, reportIds: string[]) {
  const uniqueReportIds = Array.from(new Set(reportIds))

  if (uniqueReportIds.length === 0) {
    return new Map<string, ReportAssetRow[]>()
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
        inArray(reportAssets.reportId, uniqueReportIds)
      )
    )
    .orderBy(asc(reportAssets.createdAt))

  return rows.reduce((assetsByReportId, row) => {
    const assets = assetsByReportId.get(row.reportId) ?? []
    assets.push(row)
    assetsByReportId.set(row.reportId, assets)
    return assetsByReportId
  }, new Map<string, ReportAssetRow[]>())
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

export async function listWorkspaceReports(userId: string, workspaceSlug: string) {
  const workspace = await requireWorkspaceForReportsRead(userId, workspaceSlug)
  const rows = await db
    .select(reportSelectFields())
    .from(reports)
    .where(
      and(
        eq(reports.workspaceId, workspace.id),
        isNull(reports.archivedAt)
      )
    )
    .orderBy(desc(reports.capturedAt))

  const [peopleById, assetsByReportId] = await Promise.all([
    getPeopleById(
      compactUserIds(rows.flatMap((row) => [row.reporterUserId, row.assigneeUserId]))
    ),
    getAssetsByReportId(workspace.id, rows.map((row) => row.id)),
  ])

  return {
    workspace,
    reports: rows.map((row) =>
      serializeReport(row, peopleById, assetsByReportId.get(row.id) ?? [])
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
