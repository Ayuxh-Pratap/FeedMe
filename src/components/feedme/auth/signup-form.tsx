"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { FormEvent, useState } from "react"

import { AuthButton, FeedMeField } from "@/components/feedme/auth-ui"
import { ApiClientError, postJson } from "@/lib/api-client"
import { getPasswordPolicyMessage } from "@/lib/password-policy"
import { getSafeNextPath } from "@/lib/safe-next-path"

type SignupResponse = {
  nextPath: string
}

function formValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "")
}

export function SignupForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isRedirecting, setIsRedirecting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const isBusy = isSubmitting || isRedirecting
  const passwordPolicyMessage = password
    ? getPasswordPolicyMessage(password)
    : "Use at least 8 characters with a letter and a number."
  const confirmPasswordMessage =
    confirmPassword && password !== confirmPassword
      ? "Passwords do not match."
      : confirmPassword && password === confirmPassword
        ? "Passwords match."
        : null

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (isBusy) {
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)

    const formData = new FormData(event.currentTarget)
    const nextPassword = formValue(formData, "password")
    const nextConfirmPassword = formValue(formData, "confirmPassword")
    const nextPasswordIssue = getPasswordPolicyMessage(nextPassword)

    if (nextPasswordIssue) {
      setErrorMessage(nextPasswordIssue)
      setIsSubmitting(false)
      return
    }

    if (nextPassword !== nextConfirmPassword) {
      setErrorMessage("Passwords do not match.")
      setIsSubmitting(false)
      return
    }

    try {
      const result = await postJson<SignupResponse>("/api/auth/signup", {
        email: formValue(formData, "email"),
        password: nextPassword,
        confirmPassword: nextConfirmPassword,
        nextPath: getSafeNextPath(searchParams.get("next")) ?? undefined,
      })

      setIsRedirecting(true)
      router.push(result.nextPath)
      router.refresh()
    } catch (error) {
      setErrorMessage(
        error instanceof ApiClientError
          ? error.message
          : "Unable to create your account. Please try again."
      )
      setIsSubmitting(false)
      setIsRedirecting(false)
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <FeedMeField
        id="signup-email"
        name="email"
        label="Email"
        type="email"
        placeholder="your@workemail.com"
        autoComplete="email"
        disabled={isBusy}
        required
      />
      <FeedMeField
        id="signup-password"
        name="password"
        label="Password"
        type="password"
        placeholder="********"
        autoComplete="new-password"
        disabled={isBusy}
        value={password}
        onChange={(event) => setPassword(event.currentTarget.value)}
        aria-describedby="signup-password-guidance"
        required
      />
      <p
        id="signup-password-guidance"
        className={
          password && !passwordPolicyMessage
            ? "text-body-3 text-success"
            : "text-body-3 text-muted-foreground"
        }
      >
        {password && !passwordPolicyMessage
          ? "Password looks good."
          : passwordPolicyMessage}
      </p>
      <FeedMeField
        id="confirm-password"
        name="confirmPassword"
        label="Confirm password"
        type="password"
        placeholder="********"
        autoComplete="new-password"
        disabled={isBusy}
        value={confirmPassword}
        onChange={(event) => setConfirmPassword(event.currentTarget.value)}
        aria-describedby="confirm-password-guidance"
        required
      />
      {confirmPasswordMessage ? (
        <p
          id="confirm-password-guidance"
          className={
            password === confirmPassword
              ? "text-body-3 text-success"
              : "text-body-3 text-destructive"
          }
        >
          {confirmPasswordMessage}
        </p>
      ) : null}

      {errorMessage ? (
        <p role="alert" className="text-body-3 font-medium text-destructive">
          {errorMessage}
        </p>
      ) : null}

      <AuthButton type="submit" className="w-full" disabled={isBusy}>
        {isRedirecting
          ? "Preparing welcome..."
          : isSubmitting
            ? "Creating account..."
            : "Create account"}
      </AuthButton>
    </form>
  )
}
