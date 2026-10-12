import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { assertAuthEmailConfigured } from "../server/auth/emails.ts"

test("auth email configuration fails with a public-safe service error", () => {
  assert.throws(
    () => assertAuthEmailConfigured({}),
    (error) => {
      assert.equal(error.code, "SERVICE_UNAVAILABLE")
      assert.equal(error.status, 503)
      assert.equal(
        error.message,
        "Email delivery is temporarily unavailable. Please try again shortly."
      )
      assert.doesNotMatch(error.message, /RESEND|AUTH_EMAIL_FROM|configured/i)
      return true
    }
  )
})

test("auth email configuration accepts a complete provider setup", () => {
  assert.deepEqual(
    assertAuthEmailConfigured({
      RESEND_API_KEY: "re_test",
      AUTH_EMAIL_FROM: "FeedMe <accounts@example.com>",
    }),
    {
      apiKey: "re_test",
      from: "FeedMe <accounts@example.com>",
    }
  )
})

test("signup commits account, verification token, and email event together", async () => {
  const service = await readFile(
    new URL("../server/auth/service.ts", import.meta.url),
    "utf8"
  )
  const signup = service.slice(
    service.indexOf("export async function signupWithEmail"),
    service.indexOf("export async function loginWithEmail")
  )

  assert.ok(signup.indexOf("assertAuthEmailConfigured()") >= 0)
  assert.ok(
    signup.indexOf("assertAuthEmailConfigured()") <
      signup.indexOf("hashPassword(input.password)")
  )
  assert.match(signup, /db\.batch\(\[/)
  assert.match(signup, /db\.insert\(users\)/)
  assert.match(signup, /db\.insert\(authActionTokens\)/)
  assert.match(signup, /db\.insert\(authEmailOutbox\)/)
  assert.doesNotMatch(signup, /\.update\(users\)/)
})

test("resends preserve older links and successful consumption invalidates siblings", async () => {
  const [tokens, service, outbox] = await Promise.all([
    readFile(new URL("../server/auth/action-tokens.ts", import.meta.url), "utf8"),
    readFile(new URL("../server/auth/service.ts", import.meta.url), "utf8"),
    readFile(new URL("../server/auth/email-outbox.ts", import.meta.url), "utf8"),
  ])

  assert.doesNotMatch(tokens, /\.delete\(authActionTokens\)/)
  assert.match(service, /invalidated_tokens AS/g)
  assert.match(service, /purpose" = 'email_verification'/)
  assert.match(service, /purpose" = 'password_reset'/)
  assert.match(outbox, /gt\(authActionTokens\.expiresAt, new Date\(\)\)/)
})

test("auth email outbox migration includes retry and deduplication controls", async () => {
  const migration = await readFile(
    new URL("../../drizzle/0010_auth_email_outbox.sql", import.meta.url),
    "utf8"
  )

  assert.match(migration, /CREATE TABLE "auth_email_outbox"/)
  assert.match(migration, /auth_email_outbox_dedupe_unique/)
  assert.match(migration, /auth_email_outbox_delivery_idx/)
  assert.match(migration, /auth_email_outbox_attempts_nonnegative/)
})
