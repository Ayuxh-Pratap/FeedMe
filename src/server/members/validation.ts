import { z } from "zod"

export const managedWorkspaceRoleSchema = z.enum([
  "admin",
  "developer",
  "designer",
  "reporter",
  "viewer",
])

export const managedMembershipStatusSchema = z.enum([
  "active",
  "disabled",
  "removed",
])

export const updateWorkspaceMemberInputSchema = z
  .object({
    role: managedWorkspaceRoleSchema.optional(),
    status: managedMembershipStatusSchema.optional(),
  })
  .refine((input) => input.role !== undefined || input.status !== undefined, {
    message: "Choose a role or access status to update.",
  })

export const memberUserIdParamSchema = z.string().uuid("Invalid member id.")

export type UpdateWorkspaceMemberInput = z.infer<
  typeof updateWorkspaceMemberInputSchema
>
