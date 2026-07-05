import { z } from "zod"

export const createAccessTokenSchema = z.object({
  label: z.string().trim().min(1, "Give this token a name.").max(120),
})

export const accessTokenIdParamSchema = z.string().uuid("Invalid token id.")

export type CreateAccessTokenInput = z.infer<typeof createAccessTokenSchema>
