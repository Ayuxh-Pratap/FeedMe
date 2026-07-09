import { z } from "zod"

export const listWorkspaceNotificationsInputSchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  unreadOnly: z.coerce.boolean().default(false),
})

export const markWorkspaceNotificationsReadInputSchema = z.object({
  notificationIds: z.array(z.string().uuid()).max(50).optional(),
})

export type ListWorkspaceNotificationsInput = z.infer<
  typeof listWorkspaceNotificationsInputSchema
>

export type MarkWorkspaceNotificationsReadInput = z.infer<
  typeof markWorkspaceNotificationsReadInputSchema
>
