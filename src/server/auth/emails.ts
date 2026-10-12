import { createHash } from "node:crypto"

import { AppError } from "@/server/http/errors"
import { siteConfig } from "@/lib/site"

type AuthEmailInput = {
  email: string
  idempotencyKey: string
  subject: string
  text: string
}

type AuthEmailEnvironment = Readonly<Record<string, string | undefined>>

export function assertAuthEmailConfigured(
  environment: AuthEmailEnvironment = process.env
) {
  const apiKey = environment.RESEND_API_KEY?.trim()
  const from = environment.AUTH_EMAIL_FROM?.trim()

  if (!apiKey || !from) {
    console.error("auth.email.configuration_missing", {
      missing: [
        ...(!apiKey ? ["RESEND_API_KEY"] : []),
        ...(!from ? ["AUTH_EMAIL_FROM"] : []),
      ],
    })

    throw new AppError({
      code: "SERVICE_UNAVAILABLE",
      message: "Email delivery is temporarily unavailable. Please try again shortly.",
      status: 503,
    })
  }

  return { apiKey, from }
}

async function sendAuthEmail({
  email,
  idempotencyKey,
  subject,
  text,
}: AuthEmailInput) {
  const config = assertAuthEmailConfigured()
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({
      from: config.from,
      to: [email],
      subject,
      text,
    }),
  })

  if (!response.ok) {
    console.error("auth.email.delivery_failed", {
      provider: "resend",
      status: response.status,
      requestId: response.headers.get("x-request-id"),
    })

    throw new AppError({
      code: "EMAIL_DELIVERY_FAILED",
      message: "Email delivery is temporarily unavailable. Please try again shortly.",
      status: 503,
    })
  }
}

function absoluteUrl(path: string) {
  return new URL(path, siteConfig.url).toString()
}

function emailIdempotencyKey(prefix: string, token: string) {
  return `${prefix}-${createHash("sha256").update(token).digest("hex")}`
}

export async function sendVerificationEmail(email: string, token: string) {
  const verifyUrl = absoluteUrl(`/verify-email?token=${encodeURIComponent(token)}`)

  await sendAuthEmail({
    email,
    idempotencyKey: emailIdempotencyKey("verify", token),
    subject: "Verify your FeedMe email",
    text: [
      "Verify your email to finish setting up FeedMe.",
      "",
      verifyUrl,
      "",
      "This link expires in 24 hours. If you did not create this account, you can ignore this email.",
    ].join("\n"),
  })
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const resetUrl = absoluteUrl(`/reset-password?token=${encodeURIComponent(token)}`)

  await sendAuthEmail({
    email,
    idempotencyKey: emailIdempotencyKey("reset", token),
    subject: "Reset your FeedMe password",
    text: [
      "Use this link to reset your FeedMe password.",
      "",
      resetUrl,
      "",
      "This link expires in one hour. If you did not request a reset, you can ignore this email.",
    ].join("\n"),
  })
}

export async function sendExistingAccountEmail(
  email: string,
  deliveryId = email
) {
  await sendAuthEmail({
    email,
    idempotencyKey: `existing-account-${createHash("sha256").update(deliveryId).digest("hex")}`,
    subject: "A FeedMe signup was requested",
    text: [
      "Someone tried to create a FeedMe account with this email address.",
      "",
      `You already have an account. Sign in here: ${absoluteUrl("/login")}`,
      "",
      `If you forgot your password, reset it here: ${absoluteUrl("/forgot-password")}`,
    ].join("\n"),
  })
}
