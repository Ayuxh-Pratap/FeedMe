import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm"

import { db } from "@/db"
import {
  reportAssets,
  reportComments,
  reports,
  userProfiles,
  users,
  type ReportSelectedElement,
  type ReportViewport,
} from "@/db/schema"
import {
  formatReportCapturedAgo,
  formatReportCapturedAt,
  type WorkspaceReport,
} from "@/lib/reports"
import { getInitialsFromName, getNameFromEmail } from "@/lib/team-members"
import { NotFoundError } from "@/server/http/errors"
import { assertCanWorkspaceRole } from "@/server/policies/can"
import { getWorkspaceForUserBySlug } from "@/server/workspaces/service"

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
}

type ReportAssetRow = {
  id: string
  type: "page_screenshot" | "element_screenshot" | "annotated_screenshot"
  url: string
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
      }
    }

    return {
      id: asset.id,
      label: asset.type === "element_screenshot" ? "Element" : "Annotated",
      kind: "annotated",
      url: asset.url,
    }
  })
}

function buildDeveloperPrompt(row: ReportRow) {
  return (
    row.developerPrompt ??
    `Review ${row.url}. Feedback: ${row.feedbackMessage}`
  )
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
    },
    developerPrompt: buildDeveloperPrompt(row),
    assignee: assignee
      ? {
          name: assigneeName,
          initials: getInitialsFromName(assigneeName),
        }
      : undefined,
    commentsCount: row.commentsCount,
  }
}

async function getAssetsForReport(workspaceId: string, reportId: string) {
  return db
    .select({
      id: reportAssets.id,
      type: reportAssets.type,
      url: reportAssets.url,
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

  const peopleById = await getPeopleById(
    compactUserIds(rows.flatMap((row) => [row.reporterUserId, row.assigneeUserId]))
  )

  return {
    workspace,
    reports: rows.map((row) => serializeReport(row, peopleById)),
  }
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
