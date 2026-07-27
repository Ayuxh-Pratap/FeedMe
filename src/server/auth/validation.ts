import { z } from "zod"

import { getPasswordPolicyMessage } from "@/lib/password-policy"
import { normalizeEmail } from "@/server/auth/email"
import { getSafeNextPath } from "@/lib/safe-next-path"

const safeNextPathSchema = z
  .string()
  .max(2_000)
  .transform((value, context) => {
    const safePath = getSafeNextPath(value)

    if (!safePath) {
      context.addIssue({ code: "custom", message: "Invalid destination." })
      return z.NEVER
    }

    return safePath
  })

export const emailSchema = z
  .string()
  .trim()
  .email("Enter a valid email address.")
  .max(320, "Email is too long.")
  .transform(normalizeEmail)

export const passwordSchema = z
  .string()
  .max(200, "Password is too long.")
  .superRefine((password, context) => {
    const message = getPasswordPolicyMessage(password)

    if (message) {
      context.addIssue({
        code: "custom",
        message,
      })
    }
  })

export const signupInputSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Confirm your password."),
    nextPath: safeNextPathSchema.optional(),
  })
  .refine((input) => input.password === input.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  })

export const loginInputSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password."),
})

export const requestAuthEmailInputSchema = z.object({
  email: emailSchema,
  nextPath: safeNextPathSchema.optional(),
})

export const authActionTokenInputSchema = z.object({
  token: z.string().trim().min(32).max(256),
})

export const resetPasswordInputSchema = z
  .object({
    token: z.string().trim().min(32).max(256),
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Confirm your password."),
  })
  .refine((input) => input.password === input.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  })

export const changePasswordInputSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password."),
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Confirm your password."),
  })
  .refine((input) => input.password === input.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  })

export type SignupInput = z.infer<typeof signupInputSchema>
export type LoginInput = z.infer<typeof loginInputSchema>
export type ResetPasswordInput = z.infer<typeof resetPasswordInputSchema>
export type ChangePasswordInput = z.infer<typeof changePasswordInputSchema>
