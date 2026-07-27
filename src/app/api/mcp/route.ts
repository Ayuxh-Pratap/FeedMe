import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js"
import { createMcpHandler, withMcpAuth } from "mcp-handler"
import { z } from "zod"

import {
  buildMcpPresetPrompt,
  mcpPresetDefinitions,
} from "@/lib/mcp-presets"
import type { WorkspaceReport, WorkspaceReportNoteKind } from "@/lib/reports"
import {
  resolveAccessToken,
  type AccessTokenContext,
} from "@/server/access-tokens/service"
import { AppError, NotFoundError } from "@/server/http/errors"
import {
  buildFeedMeDeveloperGuide,
  FEEDME_DEVELOPER_GUIDE_URI,
  FEEDME_MCP_SERVER_INSTRUCTIONS,
} from "@/server/mcp/developer-guide"
import {
  formatReportContextPack,
  formatReportHandoff,
  getReportImageBlocks,
} from "@/server/mcp/report-context"
import {
  createWorkspaceReportNote,
  getNextWorkspaceImplementationReport,
  getWorkspaceReport,
  listWorkspaceImplementationQueue,
  listWorkspaceReports,
  updateWorkspaceReportStatus,
} from "@/server/reports/service"
import {
  assertRateLimits,
  getRequestIp,
} from "@/server/security/rate-limit"

export const runtime = "nodejs"
export const maxDuration = 60

const reportIdSchema = z.string().uuid().describe("The FeedMe report id.")
const queueLimitSchema = z.number().int().min(1).max(50).optional()

// FeedMe's MCP endpoint is a thin transport layer. Every tool resolves its
// workspace-scoped PAT and calls the same report services as the dashboard API.
const baseHandler = createMcpHandler(
  (server) => {
    server.registerResource(
      "feedme-developer-guide",
      FEEDME_DEVELOPER_GUIDE_URI,
      {
        title: "FeedMe developer workflow guide",
        description:
          "Canonical instructions for choosing report queues, loading context, using workflow tools, handling clarification, and completing assigned work.",
        mimeType: "text/markdown",
      },
      async (_uri, extra) => {
        const context = getContext(extra)

        return {
          contents: [
            {
              uri: FEEDME_DEVELOPER_GUIDE_URI,
              mimeType: "text/markdown",
              text: buildFeedMeDeveloperGuide(context),
            },
          ],
        }
      }
    )

    server.registerTool(
      "whoami",
      {
        title: "Who am I",
        description:
          "Confirm the connected FeedMe workspace, your identity scope, and your live workspace role.",
        inputSchema: {},
      },
      async (_args, extra) => {
        const context = getContext(extra)
        return textResult(
          [
            `Connected to FeedMe workspace "${context.workspaceSlug}" as role "${context.role}".`,
            `Before the first task, read ${FEEDME_DEVELOPER_GUIDE_URI} or call get_feedme_guide.`,
            "Use list_new_assigned_reports for fresh work, list_in_progress_reports to resume work, or get_next_report to select the next issue.",
          ].join("\n")
        )
      }
    )

    server.registerTool(
      "get_feedme_guide",
      {
        title: "Get FeedMe developer guide",
        description:
          "Read the canonical FeedMe tool guide before the first task or whenever the correct report workflow is unclear.",
        inputSchema: {},
      },
      async (_args, extra) =>
        textResult(buildFeedMeDeveloperGuide(getContext(extra)))
    )

    server.registerTool(
      "list_new_assigned_reports",
      {
        title: "List new assigned reports",
        description:
          "List only fresh work assigned to you with exact status 'assigned'. Results are ordered by severity, then oldest assignment first.",
        inputSchema: { limit: queueLimitSchema },
      },
      async ({ limit }, extra) => {
        const context = getContext(extra)
        const { reports } = await listWorkspaceImplementationQueue(
          context.userId,
          context.workspaceSlug,
          { limit, status: "assigned" }
        )

        return textResult(
          formatQueueResult(
            reports,
            "No fresh assigned reports are waiting to be started.",
            "Call get_next_report to load the best report context, or get_report_context_pack with a report id."
          )
        )
      }
    )

    server.registerTool(
      "list_in_progress_reports",
      {
        title: "List in-progress reports",
        description:
          "List only work assigned to you with exact status 'in_progress'. This excludes fresh assigned and ready-for-review reports.",
        inputSchema: { limit: queueLimitSchema },
      },
      async ({ limit }, extra) => {
        const context = getContext(extra)
        const { reports } = await listWorkspaceImplementationQueue(
          context.userId,
          context.workspaceSlug,
          { limit, status: "in_progress" }
        )

        return textResult(
          formatQueueResult(
            reports,
            "No reports are currently in progress for you.",
            "Call get_report_context_pack with a report id to continue work."
          )
        )
      }
    )

    server.registerTool(
      "get_next_report",
      {
        title: "Get next assigned report",
        description:
          "Select the highest-priority fresh assigned report, breaking ties by oldest assignment, and return its complete context pack and screenshots. This read does not start work automatically.",
        inputSchema: {},
      },
      async (_args, extra) => {
        const context = getContext(extra)
        const { report: summary } = await getNextWorkspaceImplementationReport(
          context.userId,
          context.workspaceSlug
        )

        if (!summary) {
          return textResult("No fresh assigned report is waiting to be started.")
        }

        const report = await readReport(context, summary.id)
        const imageBlocks = await getReportImageBlocks(report)

        return {
          content: [
            {
              type: "text" as const,
              text: `Selected the next report without changing its status.\n\n${formatReportContextPack(
                report,
                context
              )}`,
            },
            ...imageBlocks,
          ],
        }
      }
    )

    server.registerTool(
      "list_my_reports",
      {
        title: "List my assigned reports (legacy)",
        description:
          "Compatibility tool for browsing the broader assigned queue. Prefer list_new_assigned_reports or list_in_progress_reports when choosing developer work.",
        inputSchema: {
          status: z
            .enum(["all", "open", "in_progress", "resolved"])
            .optional()
            .describe("Legacy dashboard status bucket. Defaults to all."),
          limit: queueLimitSchema,
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

        return textResult(
          formatQueueResult(
            reports,
            "No reports are assigned to you in this workspace.",
            "Use the exact queue tools for new or in-progress work."
          )
        )
      }
    )

    server.registerTool(
      "get_report",
      {
        title: "Get readable report detail",
        description:
          "Get the existing human-readable report handoff and screenshots. For canonical agent work, prefer get_report_context_pack.",
        inputSchema: { reportId: reportIdSchema },
      },
      async ({ reportId }, extra) => {
        const context = getContext(extra)

        try {
          const report = await readReport(context, reportId)
          const imageBlocks = await getReportImageBlocks(report)

          return {
            content: [
              { type: "text" as const, text: formatReportHandoff(report) },
              ...imageBlocks,
            ],
          }
        } catch (error) {
          return reportReadError(reportId, error)
        }
      }
    )

    server.registerTool(
      "get_report_context_pack",
      {
        title: "Get report context pack",
        description:
          "Get the canonical agent handoff: identity, problem, evidence, target element, implementation brief, recent notes, blockers, status history, definition of done, safe next actions, and screenshots.",
        inputSchema: { reportId: reportIdSchema },
      },
      async ({ reportId }, extra) => {
        const context = getContext(extra)

        try {
          const report = await readReport(context, reportId)
          const imageBlocks = await getReportImageBlocks(report)

          return {
            content: [
              {
                type: "text" as const,
                text: formatReportContextPack(report, context),
              },
              ...imageBlocks,
            ],
          }
        } catch (error) {
          return reportReadError(reportId, error)
        }
      }
    )

    server.registerTool(
      "start_work",
      {
        title: "Start work on a report",
        description:
          "Move a report assigned to you from 'assigned' to 'in_progress'. Only the assigned developer or designer can do this.",
        inputSchema: { reportId: reportIdSchema },
      },
      async ({ reportId }, extra) =>
        runStatusUpdate(
          getContext(extra),
          reportId,
          "in_progress",
          undefined,
          "You are now working on this report."
        )
    )

    server.registerTool(
      "mark_ready_for_review",
      {
        title: "Mark a report ready for review",
        description:
          "Mark an in-progress report assigned to you as ready for owner/admin review.",
        inputSchema: {
          reportId: reportIdSchema,
          note: z
            .string()
            .trim()
            .max(1000)
            .optional()
            .describe("What changed and how it was verified."),
        },
      },
      async ({ reportId, note }, extra) =>
        runStatusUpdate(
          getContext(extra),
          reportId,
          "ready_for_review",
          note,
          "Report marked ready for review."
        )
    )

    server.registerTool(
      "add_work_note",
      {
        title: "Add a work note",
        description:
          "Record implementation findings while work is in progress, or material reviewer context while the report is ready for review.",
        inputSchema: {
          reportId: reportIdSchema,
          note: z.string().trim().min(1).max(5000),
        },
      },
      async ({ reportId, note }, extra) =>
        runCreateNote(
          getContext(extra),
          reportId,
          "work_note",
          note,
          "Work note added."
        )
    )

    server.registerTool(
      "mark_blocked",
      {
        title: "Record a blocker",
        description:
          "Record what prevents an assigned or in-progress report from progressing. This adds a blocker note; it does not invent a blocked report status.",
        inputSchema: {
          reportId: reportIdSchema,
          reason: z.string().trim().min(1).max(5000),
        },
      },
      async ({ reportId, reason }, extra) =>
        runCreateNote(
          getContext(extra),
          reportId,
          "blocker",
          reason,
          "Blocker recorded."
        )
    )

    server.registerTool(
      "ask_for_clarification",
      {
        title: "Ask for clarification",
        description:
          "Create a clarification request while a report is assigned or in progress, then notify workspace owners/admins plus the original reporter. This does not change status or mark the report blocked.",
        inputSchema: {
          reportId: reportIdSchema,
          question: z
            .string()
            .trim()
            .min(3)
            .max(5000)
            .describe("One clear implementation question."),
        },
      },
      async ({ reportId, question }, extra) =>
        runCreateNote(
          getContext(extra),
          reportId,
          "clarification_request",
          question,
          "Clarification requested."
        )
    )

    const promptArgsSchema = {
      reportId: z.string().uuid().optional(),
      strictness: z.enum(["quick", "normal", "deep"]).optional(),
      allowCodeChanges: z.enum(["true", "false"]).optional(),
      runChecks: z.enum(["true", "false"]).optional(),
    }

    for (const preset of mcpPresetDefinitions) {
      server.registerPrompt(
        preset.name,
        {
          title: preset.title,
          description: preset.description,
          argsSchema: promptArgsSchema,
        },
        async ({ reportId, strictness, allowCodeChanges, runChecks }) => ({
          messages: [
            {
              role: "user" as const,
              content: {
                type: "text" as const,
                text: buildMcpPresetPrompt(preset.name, {
                  reportId,
                  strictness,
                  allowCodeChanges: parsePromptBoolean(allowCodeChanges),
                  runChecks: parsePromptBoolean(runChecks),
                }),
              },
            },
          ],
        })
      )
    }
  },
  {
    instructions: FEEDME_MCP_SERVER_INSTRUCTIONS,
    serverInfo: { name: "feedme", version: "0.3.0" },
  },
  { basePath: "/api", disableSse: true }
)

async function readReport(context: AccessTokenContext, reportId: string) {
  const { report } = await getWorkspaceReport(
    context.userId,
    context.workspaceSlug,
    reportId
  )

  return report
}

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

    return textResult(`${successText} Status is now "${report.status}".`)
  } catch (error) {
    return mutationError(error, `Could not update report ${reportId}.`)
  }
}

async function runCreateNote(
  context: AccessTokenContext,
  reportId: string,
  kind: WorkspaceReportNoteKind,
  body: string,
  successText: string
) {
  try {
    await createWorkspaceReportNote(
      context.userId,
      context.workspaceSlug,
      reportId,
      { kind, body }
    )

    return textResult(`${successText} The report activity has been updated.`)
  } catch (error) {
    return mutationError(error, `Could not add a note to report ${reportId}.`)
  }
}

function formatQueueResult(
  reports: WorkspaceReport[],
  emptyText: string,
  nextInstruction: string
) {
  if (reports.length === 0) {
    return emptyText
  }

  const lines = reports.map(
    (report) =>
      `- ${report.id} [${report.severity} / ${report.status}] ${report.title} - ${report.domain} (${report.capturedAgo})`
  )

  return `${reports.length} report(s):\n${lines.join("\n")}\n\n${nextInstruction}`
}

function reportReadError(reportId: string, error: unknown) {
  if (error instanceof NotFoundError) {
    return mutationError(error, `Report ${reportId} was not found in this workspace.`)
  }

  throw error
}

function mutationError(error: unknown, fallback: string) {
  return {
    isError: true,
    content: [
      {
        type: "text" as const,
        text: error instanceof AppError ? error.message : fallback,
      },
    ],
  }
}

function textResult(text: string) {
  return { content: [{ type: "text" as const, text }] }
}

function parsePromptBoolean(value?: "true" | "false") {
  return value === undefined ? undefined : value === "true"
}

async function verifyToken(
  request: Request,
  bearerToken?: string
): Promise<AuthInfo | undefined> {
  if (!bearerToken) {
    return undefined
  }

  await assertRateLimits([
    {
      key: bearerToken,
      limit: 120,
      scope: "mcp.token",
      windowMs: 60 * 1000,
    },
    {
      key: getRequestIp(request),
      limit: 240,
      scope: "mcp.ip",
      windowMs: 60 * 1000,
    },
    {
      key: bearerToken,
      limit: 10_000,
      scope: "mcp.token_daily",
      windowMs: 24 * 60 * 60 * 1000,
    },
  ])

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

function getContext(extra: unknown): AccessTokenContext {
  const authInfo = (extra as { authInfo?: { extra?: unknown } }).authInfo
  const context = authInfo?.extra as AccessTokenContext | undefined

  if (!context) {
    throw new Error("Missing FeedMe access context on this request.")
  }

  return context
}

const handler = withMcpAuth(baseHandler, verifyToken, { required: true })

export { handler as GET, handler as POST, handler as DELETE }
