import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js"
import { createMcpHandler, withMcpAuth } from "mcp-handler"
import { z } from "zod"

import {
  resolveAccessToken,
  type AccessTokenContext,
} from "@/server/access-tokens/service"
import {
  AppError,
  NotFoundError,
} from "@/server/http/errors"
import {
  getWorkspaceReport,
  listWorkspaceReports,
  updateWorkspaceReportStatus,
} from "@/server/reports/service"
import type { WorkspaceReport } from "@/lib/reports"

export const runtime = "nodejs"
export const maxDuration = 60

// The MCP handler exposes FeedMe's report workflow to a developer's coding agent.
// Auth is a workspace-scoped personal access token (Bearer). Every tool resolves
// its context from the token and reuses the existing report services, so tenant
// scoping and role checks are enforced exactly like the REST API.
const baseHandler = createMcpHandler(
  (server) => {
    server.registerTool(
      "whoami",
      {
        title: "Who am I",
        description:
          "Confirm the connected FeedMe workspace, your display identity, and your role.",
        inputSchema: {},
      },
      async (_args, extra) => {
        const context = getContext(extra)
        return {
          content: [
            {
              type: "text",
              text: `Connected to FeedMe workspace "${context.workspaceSlug}" as role "${context.role}".`,
            },
          ],
        }
      }
    )

    server.registerTool(
      "list_my_reports",
      {
        title: "List my assigned reports",
        description:
          "List the FeedMe reports assigned to you in this workspace so you can pick one to fix. Returns report ids, titles, severity, and status.",
        inputSchema: {
          status: z
            .enum(["all", "open", "in_progress", "resolved"])
            .optional()
            .describe("Filter by status. Defaults to all."),
          limit: z.number().int().min(1).max(50).optional(),
        },
      },
      async ({ status, limit }, extra) => {
        const context = getContext(extra)
        const { reports } = await listWorkspaceReports(
          context.userId,
          context.workspaceSlug,
          {
            scope: "assigned",
            status: status ?? "all",
            sort: "newest",
            limit: limit ?? 20,
          }
        )

        if (reports.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: "No reports are assigned to you in this workspace.",
              },
            ],
          }
        }

        const lines = reports.map(
          (report) =>
            `- ${report.id}  [${report.severity} / ${report.status}]  ${report.title}  — ${report.domain} (${report.capturedAgo})`
        )

        return {
          content: [
            {
              type: "text",
              text: `You have ${reports.length} assigned report(s):\n${lines.join(
                "\n"
              )}\n\nCall get_report(reportId) for full detail and screenshots.`,
            },
          ],
        }
      }
    )

    server.registerTool(
      "get_report",
      {
        title: "Get report detail",
        description:
          "Get full developer-handoff detail for a FeedMe report: the feedback, the exact selected element and CSS selector, page/browser context, the developer prompt, and the captured screenshots as images.",
        inputSchema: {
          reportId: z.string().uuid().describe("The report id from list_my_reports."),
        },
      },
      async ({ reportId }, extra) => {
        const context = getContext(extra)

        let report: WorkspaceReport
        try {
          const result = await getWorkspaceReport(
            context.userId,
            context.workspaceSlug,
            reportId
          )
          report = result.report
        } catch (error) {
          if (error instanceof NotFoundError) {
            return {
              isError: true,
              content: [
                {
                  type: "text",
                  text: `Report ${reportId} was not found in this workspace.`,
                },
              ],
            }
          }
          throw error
        }

        const imageBlocks = await getReportImageBlocks(report)

        return {
          content: [
            { type: "text", text: formatReportHandoff(report) },
            ...imageBlocks,
          ],
        }
      }
    )

    server.registerTool(
      "start_work",
      {
        title: "Start work on a report",
        description:
          "Move a report that is assigned to you from 'assigned' to 'in_progress'. Only the assigned developer can do this.",
        inputSchema: {
          reportId: z.string().uuid().describe("The report id to start working on."),
        },
      },
      async ({ reportId }, extra) => {
        const context = getContext(extra)
        return runStatusUpdate(
          context,
          reportId,
          "in_progress",
          undefined,
          "You are now working on this report."
        )
      }
    )

    server.registerTool(
      "mark_ready_for_review",
      {
        title: "Mark a report ready for review",
        description:
          "Mark a report that is assigned to you as 'ready_for_review' once you have made the fix. Only the assigned developer can do this.",
        inputSchema: {
          reportId: z.string().uuid().describe("The report id you have finished."),
          note: z
            .string()
            .trim()
            .max(1000)
            .optional()
            .describe("Optional note for reviewers, e.g. what you changed."),
        },
      },
      async ({ reportId, note }, extra) => {
        const context = getContext(extra)
        return runStatusUpdate(
          context,
          reportId,
          "ready_for_review",
          note,
          "Report marked ready for review."
        )
      }
    )
  },
  { serverInfo: { name: "feedme", version: "0.1.0" } },
  { basePath: "/api", disableSse: true }
)

async function runStatusUpdate(
  context: AccessTokenContext,
  reportId: string,
  status: "in_progress" | "ready_for_review",
  note: string | undefined,
  successText: string
) {
  try {
    const { report } = await updateWorkspaceReportStatus(
      context.userId,
      context.workspaceSlug,
      reportId,
      { status, ...(note ? { note } : {}) }
    )

    return {
      content: [
        {
          type: "text" as const,
          text: `${successText} Status is now "${report.status}".`,
        },
      ],
    }
  } catch (error) {
    return {
      isError: true,
      content: [
        {
          type: "text" as const,
          text:
            error instanceof AppError
              ? error.message
              : `Could not update report ${reportId}.`,
        },
      ],
    }
  }
}

async function verifyToken(
  _request: Request,
  bearerToken?: string
): Promise<AuthInfo | undefined> {
  if (!bearerToken) {
    return undefined
  }

  const context = await resolveAccessToken(bearerToken)
  if (!context) {
    return undefined
  }

  return {
    token: bearerToken,
    clientId: context.userId,
    scopes: [],
    extra: context,
  }
}

const handler = withMcpAuth(baseHandler, verifyToken, { required: true })

export { handler as GET, handler as POST, handler as DELETE }

function getContext(extra: unknown): AccessTokenContext {
  const authInfo = (extra as { authInfo?: { extra?: unknown } }).authInfo
  const context = authInfo?.extra as AccessTokenContext | undefined

  if (!context) {
    throw new Error("Missing FeedMe access context on this request.")
  }

  return context
}

function formatReportHandoff(report: WorkspaceReport): string {
  const element = report.selectedElement
  const attributeEntries = Object.entries(element.attributes ?? {})
  const attributes =
    attributeEntries.length > 0
      ? attributeEntries.map(([key, value]) => `${key}="${value}"`).join(" ")
      : "none"

  return [
    `# ${report.title}`,
    `Severity: ${report.severity} | Status: ${report.status} | Type: ${report.type}`,
    `Domain: ${report.domain} | URL: ${report.url}`,
    `Captured: ${report.capturedAt} | Browser: ${report.browser} | Device: ${report.device} | Viewport: ${report.viewport}`,
    "",
    "## Summary",
    report.summary,
    "",
    "## Reporter feedback",
    `${report.feedback.message} — ${report.feedback.reporterName}`,
    "",
    "## Selected element",
    `Tag: ${element.tag}`,
    `Selector: ${element.selector}`,
    element.text ? `Text: ${element.text}` : "Text: none",
    `Attributes: ${attributes}`,
    "",
    "## Developer prompt",
    report.developerPrompt,
  ].join("\n")
}

// Embed up to three screenshots as images the agent can actually see. Uses the
// optimized thumbnail so the payload stays light; failures are skipped so a
// missing image never breaks the handoff.
async function getReportImageBlocks(report: WorkspaceReport) {
  const sources = report.screenshots
    .map((screenshot) => screenshot.thumbnailUrl ?? screenshot.url)
    .filter((url): url is string => Boolean(url))
    .slice(0, 3)

  const blocks = await Promise.all(sources.map(fetchImageBlock))

  return blocks.filter(
    (block): block is { type: "image"; data: string; mimeType: string } =>
      block !== null
  )
}

async function fetchImageBlock(url: string) {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      return null
    }

    const mimeType = response.headers.get("content-type") ?? "image/png"
    const data = Buffer.from(await response.arrayBuffer()).toString("base64")

    return { type: "image" as const, data, mimeType }
  } catch {
    return null
  }
}
