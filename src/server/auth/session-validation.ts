import { z } from "zod"

export const sessionIdParamSchema = z.string().uuid("Invalid session id.")
