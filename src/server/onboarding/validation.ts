import { z } from "zod"

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

export const workspaceOnboardingInputSchema = z.object({
  workspaceName: z
    .string()
    .trim()
    .min(1, "Enter a workspace name.")
    .max(120, "Workspace name is too long."),
  firstDomain: z.string().trim().min(1, "Enter the first domain."),
})

export type ProfileInput = z.infer<typeof profileInputSchema>
export type WorkspaceOnboardingInput = z.infer<typeof workspaceOnboardingInputSchema>
