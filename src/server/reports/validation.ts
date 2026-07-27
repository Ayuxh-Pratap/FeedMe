import { z } from "zod"

import { isAllowedCloudinaryImageUrl } from "@/server/uploads/cloudinary"

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

export const reportCountsInputSchema = z.object({
  q: optionalTrimmedString(120),
  scope: z.enum(["assigned", "reported"]).optional(),
})

export const listReportCommentsInputSchema = z.object({
  cursor: optionalTrimmedString(500),
  limit: z.coerce.number().int().min(1).max(30).default(10),
  parentCommentId: z.string().uuid("Choose a valid parent comment.").optional(),
  targetCommentId: z.string().uuid("Choose a valid comment.").optional(),
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

// Screenshots must be hosted externally (Cloudinary), never inlined as base64.
// Rejecting data:/blob: URLs keeps report_assets.url a small pointer instead of
// a multi-megabyte payload sitting in Postgres.
const reportAssetUrlSchema = z
  .string()
  .url()
  .refine((value) => /^https?:\/\//i.test(value), {
    message: "Screenshots must be uploaded to storage before submitting.",
  })
  .refine(isAllowedCloudinaryImageUrl, {
    message: "Screenshots must use FeedMe image storage.",
  })
  .refine((value) => /\.(?:jpe?g|png|webp)$/i.test(new URL(value).pathname), {
    message: "Screenshots must be PNG, JPEG, or WebP images.",
  })

const reportAssetInputSchema = z
  .object({
    type: z.enum([
      "page_screenshot",
      "element_screenshot",
      "annotated_screenshot",
    ]),
    url: reportAssetUrlSchema,
    mimeType: z.enum(["image/png", "image/jpeg", "image/jpg", "image/webp"]).optional(),
    width: z.number().int().positive().max(10000).optional(),
    height: z.number().int().positive().max(10000).optional(),
  })
  .superRefine((asset, context) => {
    if (asset.width && asset.height && asset.width * asset.height > 25_000_000) {
      context.addIssue({
        code: "custom",
        message: "Screenshots cannot exceed 25 megapixels.",
      })
    }
  })

export const createReportInputSchema = z.object({
  clientReportId: z
    .string()
    .trim()
    .min(8)
    .max(160)
    .regex(/^[a-zA-Z0-9:_-]+$/, "Invalid client report id.")
    .optional(),
  url: z
    .string()
    .trim()
    .url("Enter a valid report URL.")
    .refine((value) => /^https?:\/\//i.test(value), {
      message: "Report URL must be a web page.",
    }),
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
export type ListReportCommentsInput = z.infer<
  typeof listReportCommentsInputSchema
>
export type ReportCountsInput = z.infer<typeof reportCountsInputSchema>

export const assignReportInputSchema = z.object({
  assigneeUserId: z.string().uuid("Choose a valid teammate.").nullable(),
  note: z.string().trim().max(1000).optional(),
})

export const updateReportStatusInputSchema = z.object({
  status: mutableReportStatusSchema,
  note: z.string().trim().max(1000).optional(),
})

const implementationBriefListItemSchema = z
  .string()
  .trim()
  .min(1)
  .max(500)

const implementationBriefListSchema = z
  .array(implementationBriefListItemSchema)
  .max(30)
  .default([])

const implementationBriefReferenceLinkSchema = z.object({
  label: optionalTrimmedString(120),
  url: z.string().trim().url("Enter a valid reference link.").max(2000),
})

export const updateReportImplementationBriefInputSchema = z.object({
  acceptanceCriteria: implementationBriefListSchema,
  implementationNotes: optionalTrimmedString(5000),
  constraintsNonGoals: implementationBriefListSchema,
  expectedBehavior: optionalTrimmedString(3000),
  referenceLinks: z
    .array(implementationBriefReferenceLinkSchema)
    .max(12)
    .default([]),
  reviewChecklist: implementationBriefListSchema,
})

const bulkTaskAssigneeSchema = z
  .object({
    email: z.string().trim().email().max(320).optional(),
    userId: z.string().uuid().optional(),
  })
  .strict()
  .superRefine((assignee, context) => {
    if (Number(Boolean(assignee.email)) + Number(Boolean(assignee.userId)) !== 1) {
      context.addIssue({
        code: "custom",
        message: "Provide exactly one assignee email or user id.",
      })
    }
  })

const bulkTaskImplementationBriefSchema =
  updateReportImplementationBriefInputSchema.partial().strict()

export const bulkCreateTasksInputSchema = z
  .object({
    tasks: z
      .array(
        z
          .object({
            clientTaskId: z
              .string()
              .trim()
              .min(8)
              .max(160)
              .regex(/^[a-zA-Z0-9:_-]+$/, "Invalid client task id."),
            title: z.string().trim().min(3).max(180),
            description: z.string().trim().min(3).max(5000),
            summary: z.string().trim().min(3).max(2000).optional(),
            severity: z
              .enum(["low", "medium", "high", "urgent"])
              .default("medium"),
            type: z
              .enum([
                "bug",
                "ux",
                "design",
                "copy",
                "performance",
                "accessibility",
              ])
              .default("bug"),
            url: z
              .string()
              .trim()
              .url("Enter a valid task URL.")
              .refine((value) => /^https?:\/\//i.test(value), {
                message: "Task URL must be a web page.",
              })
              .optional(),
            assignee: bulkTaskAssigneeSchema.optional(),
            developerPrompt: z.string().trim().max(8000).optional(),
            implementationBrief: bulkTaskImplementationBriefSchema.optional(),
            createdAt: z.string().datetime().optional(),
          })
          .strict()
      )
      .min(1)
      .max(25),
  })
  .strict()
  .superRefine(({ tasks }, context) => {
    const seenIds = new Set<string>()

    tasks.forEach((task, index) => {
      if (seenIds.has(task.clientTaskId)) {
        context.addIssue({
          code: "custom",
          message: "Client task ids must be unique within one bulk request.",
          path: ["tasks", index, "clientTaskId"],
        })
      }

      seenIds.add(task.clientTaskId)
    })
  })

export const reportNoteKindInputSchema = z.enum([
  "work_note",
  "blocker",
  "clarification_request",
  "clarification",
  "review_note",
])

export const createReportNoteInputSchema = z.object({
  body: z.string().trim().min(1).max(5000),
  kind: reportNoteKindInputSchema,
})

export const createReportCommentInputSchema = z.object({
  clientMutationId: z
    .string()
    .trim()
    .min(8)
    .max(160)
    .regex(/^[a-zA-Z0-9:_-]+$/, "Invalid comment mutation id."),
  body: z.string().trim().min(1).max(5000),
  mentionedUserIds: z.array(z.string().uuid()).max(20).default([]),
  parentCommentId: z.string().uuid("Choose a valid parent comment.").nullable().optional(),
})

export const updateReportCommentInputSchema = z.object({
  body: z.string().trim().min(1).max(5000),
  mentionedUserIds: z.array(z.string().uuid()).max(20).optional(),
})

export const reportCommentReactionInputSchema = z.enum([
  "seen",
  "agree",
  "blocked",
  "helpful",
])

export const updateReportCommentReactionInputSchema = z.object({
  enabled: z.boolean(),
  reaction: reportCommentReactionInputSchema,
})

export const commentIdParamSchema = z.string().uuid("Choose a valid comment.")

export type AssignReportInput = z.infer<typeof assignReportInputSchema>
export type UpdateReportStatusInput = z.infer<typeof updateReportStatusInputSchema>
export type BulkCreateTasksInput = z.infer<typeof bulkCreateTasksInputSchema>
export type UpdateReportImplementationBriefInput = z.infer<
  typeof updateReportImplementationBriefInputSchema
>
export type CreateReportNoteInput = z.infer<typeof createReportNoteInputSchema>
export type CreateReportCommentInput = z.infer<
  typeof createReportCommentInputSchema
>
export type UpdateReportCommentInput = z.infer<
  typeof updateReportCommentInputSchema
>
export type UpdateReportCommentReactionInput = z.infer<
  typeof updateReportCommentReactionInputSchema
>
