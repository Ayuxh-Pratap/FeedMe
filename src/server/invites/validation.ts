import { z } from "zod"

export const inviteAssignableRoleSchema = z.enum([
  "admin",
  "developer",
  "designer",
  "reporter",
  "viewer",
])

export const createInviteInputSchema = z.object({
  role: inviteAssignableRoleSchema.default("reporter"),
  maxUses: z.number().int().positive().max(500).optional().default(1),
  expiresAt: z.string().datetime().nullable().optional(),
})

export const inviteCodeParamSchema = z
  .string()
  .trim()
  .min(8, "Invalid invite code.")
  .max(128, "Invalid invite code.")

export type InviteAssignableRole = z.infer<typeof inviteAssignableRoleSchema>
export type CreateInviteInput = z.infer<typeof createInviteInputSchema>
