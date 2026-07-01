import { z } from "zod"

export const reportIdParamSchema = z.string().uuid("Invalid report id.")
