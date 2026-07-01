import { z } from "zod"

export const addWorkspaceDomainInputSchema = z
  .object({
    domain: z.string().trim().optional(),
    host: z.string().trim().optional(),
  })
  .transform((input) => ({
    domain: input.domain ?? input.host ?? "",
  }))

export const domainIdParamSchema = z.string().uuid("Invalid domain id.")

export type AddWorkspaceDomainInput = z.infer<typeof addWorkspaceDomainInputSchema>
