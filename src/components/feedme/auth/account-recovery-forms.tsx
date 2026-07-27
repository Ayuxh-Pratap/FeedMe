"use client"

import { useRouter } from "next/navigation"
import { FormEvent, useEffect, useRef, useState } from "react"

import { AuthButton, FeedMeField } from "@/components/feedme/auth-ui"
import { ApiClientError, postJson } from "@/lib/api-client"
import { getPasswordPolicyMessage } from "@/lib/password-policy"

type MessageResponse = { message: string }
type AuthResponse = { nextPath: string }

function formValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "")
}

function RequestEmailForm({
  endpoint,
  buttonLabel,
}: {
  endpoint: "/api/auth/forgot-password" | "/api/auth/resend-verification"
  buttonLabel: string
}) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSubmitting) return

    setIsSubmitting(true)
    setErrorMessage(null)
    setSuccessMessage(null)
    const formData = new FormData(event.currentTarget)

    try {
      const result = await postJson<MessageResponse>(endpoint, {
        email: formValue(formData, "email"),
      })
      setSuccessMessage(result.message)
    } catch (error) {
      setErrorMessage(
        error instanceof ApiClientError
          ? error.message
          : "Unable to send the email. Please try again."
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <FeedMeField
        id={`${endpoint}-email`}
        name="email"
        label="Email"
        type="email"
        placeholder="your@workemail.com"
        autoComplete="email"
        disabled={isSubmitting}
        required
      />
      {errorMessage ? <p role="alert" className="text-body-3 font-medium text-destructive">{errorMessage}</p> : null}
      {successMessage ? <p role="status" className="text-body-3 font-medium text-success">{successMessage}</p> : null}
      <AuthButton type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Sending..." : buttonLabel}
      </AuthButton>
    </form>
  )
}

export function ForgotPasswordForm() {
  return <RequestEmailForm endpoint="/api/auth/forgot-password" buttonLabel="Send reset link" />
}

export function ResendVerificationForm() {
  return <RequestEmailForm endpoint="/api/auth/resend-verification" buttonLabel="Send a new link" />
}

export function VerifyEmailForm({ token }: { token: string | null }) {
  const router = useRouter()
  const startedRef = useRef(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!token || startedRef.current) return
    startedRef.current = true

    void postJson<AuthResponse>("/api/auth/verify-email", { token })
      .then((result) => {
        router.replace(result.nextPath)
        router.refresh()
      })
      .catch((error) => {
        setErrorMessage(
          error instanceof ApiClientError
            ? error.message
            : "Unable to verify this email. Request a new link."
        )
      })
  }, [router, token])

  if (!token) {
    return <p role="alert" className="text-body-3 font-medium text-destructive">This verification link is incomplete.</p>
  }

  if (errorMessage) {
    return <p role="alert" className="text-body-3 font-medium text-destructive">{errorMessage}</p>
  }

  return <p role="status" className="text-center text-body-2 text-text-body">Verifying your email...</p>
}

export function ResetPasswordForm({ token }: { token: string | null }) {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isRedirecting, setIsRedirecting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const isBusy = isSubmitting || isRedirecting
  const passwordIssue = password ? getPasswordPolicyMessage(password) : null

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isBusy || !token) return

    const nextPasswordIssue = getPasswordPolicyMessage(password)
    if (nextPasswordIssue) {
      setErrorMessage(nextPasswordIssue)
      return
    }
    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.")
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)
    try {
      const result = await postJson<AuthResponse>("/api/auth/reset-password", {
        token,
        password,
        confirmPassword,
      })
      setIsRedirecting(true)
      router.replace(result.nextPath)
      router.refresh()
    } catch (error) {
      setErrorMessage(
        error instanceof ApiClientError
          ? error.message
          : "Unable to reset your password. Please try again."
      )
      setIsSubmitting(false)
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <FeedMeField
        id="reset-password"
        label="New password"
        type="password"
        autoComplete="new-password"
        placeholder="********"
        value={password}
        onChange={(event) => setPassword(event.currentTarget.value)}
        disabled={isBusy || !token}
        required
      />
      <p className={password && !passwordIssue ? "text-body-3 text-success" : "text-body-3 text-muted-foreground"}>
        {password && !passwordIssue ? "Password looks good." : passwordIssue ?? "Use at least 8 characters with a letter and a number."}
      </p>
      <FeedMeField
        id="reset-confirm-password"
        label="Confirm password"
        type="password"
        autoComplete="new-password"
        placeholder="********"
        value={confirmPassword}
        onChange={(event) => setConfirmPassword(event.currentTarget.value)}
        disabled={isBusy || !token}
        required
      />
      {!token ? <p role="alert" className="text-body-3 font-medium text-destructive">This reset link is incomplete.</p> : null}
      {errorMessage ? <p role="alert" className="text-body-3 font-medium text-destructive">{errorMessage}</p> : null}
      <AuthButton type="submit" className="w-full" disabled={isBusy || !token}>
        {isRedirecting ? "Opening workspace..." : isSubmitting ? "Updating password..." : "Reset password"}
      </AuthButton>
    </form>
  )
}
