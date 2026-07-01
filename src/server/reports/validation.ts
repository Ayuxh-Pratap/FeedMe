import { z } from "zod"

export const reportIdParamSchema = z.string().uuid("Invalid report id.")

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
  assets: z.array(reportAssetInputSchema).max(3).optional().default([]),
})

export type CreateReportInput = z.infer<typeof createReportInputSchema>
