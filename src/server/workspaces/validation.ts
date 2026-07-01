import { z } from "zod"

export const createWorkspaceInputSchema = z.object({
  workspaceName: z
    .string()
    .trim()
    .min(1, "Enter a workspace name.")
    .max(120, "Workspace name is too long."),
  firstDomain: z.string().trim().min(1, "Enter the first domain."),
})

export const addWorkspaceDomainInputSchema = z
  .object({
    domain: z.string().trim().optional(),
    host: z.string().trim().optional(),
  })
  .transform((input) => ({
    domain: input.domain ?? input.host ?? "",
  }))

export const domainIdParamSchema = z.string().uuid("Invalid domain id.")

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceInputSchema>
export type AddWorkspaceDomainInput = z.infer<typeof addWorkspaceDomainInputSchema>
