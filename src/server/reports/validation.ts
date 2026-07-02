import { z } from "zod"

export const reportIdParamSchema = z.string().uuid("Invalid report id.")

const optionalTrimmedString = (max: number) =>
  z.preprocess(
    (value) => {
      if (typeof value !== "string") {
        return value
      }

      const nextValue = value.trim()

      return nextValue.length > 0 ? nextValue : undefined
    },
    z.string().trim().max(max).optional()
  )

export const listReportsInputSchema = z.object({
  cursor: optionalTrimmedString(500),
  limit: z.coerce.number().int().min(1).max(50).default(30),
  q: optionalTrimmedString(120),
  scope: z.enum(["assigned", "reported"]).optional(),
  sort: z.enum(["newest", "oldest", "priority", "comments"]).default("newest"),
  status: z.enum(["all", "open", "in_progress", "resolved"]).default("all"),
})

export const mutableReportStatusSchema = z.enum([
  "reviewing",
  "accepted",
  "needs_info",
  "duplicate",
  "rejected",
  "assigned",
  "in_progress",
  "ready_for_review",
  "resolved",
  "archived",
])

const reportViewportInputSchema = z.object({
  width: z.number().int().positive().max(10000),
  height: z.number().int().positive().max(10000),
  devicePixelRatio: z.number().positive().max(10).default(1),
  scrollX: z.number().min(0).default(0),
  scrollY: z.number().min(0).default(0),
})

const reportSelectedElementInputSchema = z.object({
  tag: z.string().trim().min(1).max(80),
  selector: z.string().trim().min(1).max(1200),
  text: z.string().trim().max(2000).optional(),
  attributes: z.record(z.string(), z.string()).optional().default({}),
  boundingBox: z
    .object({
      x: z.number(),
      y: z.number(),
      width: z.number().nonnegative(),
      height: z.number().nonnegative(),
    })
    .optional(),
})

const reportAssetInputSchema = z.object({
  type: z.enum([
    "page_screenshot",
    "element_screenshot",
    "annotated_screenshot",
  ]),
  url: z.string().url(),
  mimeType: z.string().trim().max(80).optional(),
  width: z.number().int().positive().max(10000).optional(),
  height: z.number().int().positive().max(10000).optional(),
})

export const createReportInputSchema = z.object({
  url: z.string().trim().url("Enter a valid report URL."),
  title: z.string().trim().min(3).max(180).optional(),
  summary: z.string().trim().min(3).max(2000).optional(),
  severity: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  type: z
    .enum(["bug", "ux", "design", "copy", "performance", "accessibility"])
    .default("ux"),
  browser: z.string().trim().max(120).optional(),
  device: z.string().trim().max(120).optional(),
  viewport: reportViewportInputSchema,
  selectedElement: reportSelectedElementInputSchema,
  feedbackMessage: z.string().trim().min(3).max(5000),
  developerPrompt: z.string().trim().max(8000).optional(),
  capturedAt: z.string().datetime().optional(),
  assets: z
    .array(reportAssetInputSchema)
    .min(1, "FeedMe needs a screenshot to save this report.")
    .max(3),
})

export type CreateReportInput = z.infer<typeof createReportInputSchema>
export type ListReportsInput = z.infer<typeof listReportsInputSchema>

export const assignReportInputSchema = z.object({
  assigneeUserId: z.string().uuid("Choose a valid teammate.").nullable(),
  note: z.string().trim().max(1000).optional(),
})

export const updateReportStatusInputSchema = z.object({
  status: mutableReportStatusSchema,
  note: z.string().trim().max(1000).optional(),
})

export type AssignReportInput = z.infer<typeof assignReportInputSchema>
export type UpdateReportStatusInput = z.infer<typeof updateReportStatusInputSchema>
