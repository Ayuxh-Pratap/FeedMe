import { z } from "zod"

export {
  createWorkspaceInputSchema as workspaceOnboardingInputSchema,
  type CreateWorkspaceInput as WorkspaceOnboardingInput,
} from "@/server/workspaces/validation"

function optionalText(max: number) {
  return z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : undefined))
}

export const profileInputSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(1, "Enter your full name.")
    .max(160, "Full name is too long."),
  displayName: optionalText(80),
  title: optionalText(120),
})

export type ProfileInput = z.infer<typeof profileInputSchema>
