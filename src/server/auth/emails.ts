import { createHash } from "node:crypto"

import { AppError } from "@/server/http/errors"
import { siteConfig } from "@/lib/site"

type AuthEmailInput = {
  email: string
  idempotencyKey: string
  subject: string
  text: string
}

function getEmailConfig() {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  const from = process.env.AUTH_EMAIL_FROM?.trim()

  if (!apiKey || !from) {
    throw new AppError({
      code: "EMAIL_NOT_CONFIGURED",
      message: "Account email delivery is not configured.",
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
  const config = getEmailConfig()
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
    throw new AppError({
      code: "EMAIL_DELIVERY_FAILED",
      message: "We could not send that email. Please try again.",
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

export async function sendExistingAccountEmail(email: string) {
  await sendAuthEmail({
    email,
    idempotencyKey: `existing-account-${createHash("sha256").update(email).digest("hex")}`,
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
