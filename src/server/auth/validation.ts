import { z } from "zod"

import { getPasswordPolicyMessage } from "@/lib/password-policy"
import { normalizeEmail } from "@/server/auth/email"

const emailSchema = z
  .string()
  .trim()
  .email("Enter a valid email address.")
  .max(320, "Email is too long.")
  .transform(normalizeEmail)

const passwordSchema = z
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
  })
  .refine((input) => input.password === input.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  })

export const loginInputSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password."),
})

export type SignupInput = z.infer<typeof signupInputSchema>
export type LoginInput = z.infer<typeof loginInputSchema>
