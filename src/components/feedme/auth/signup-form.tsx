"use client"

import { useRouter } from "next/navigation"
import { FormEvent, useState } from "react"

import { AuthButton, FeedMeField } from "@/components/feedme/auth-ui"
import { ApiClientError, postJson } from "@/lib/api-client"

type SignupResponse = {
  user: {
    id: string
    email: string
  }
  nextPath: string
}

function formValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "")
}

export function SignupForm() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSubmitting(true)
    setErrorMessage(null)

    const formData = new FormData(event.currentTarget)

    try {
      const result = await postJson<SignupResponse>("/api/auth/signup", {
        email: formValue(formData, "email"),
        password: formValue(formData, "password"),
        confirmPassword: formValue(formData, "confirmPassword"),
      })

      router.push(result.nextPath)
      router.refresh()
    } catch (error) {
      setErrorMessage(
        error instanceof ApiClientError
          ? error.message
          : "Unable to create your account. Please try again."
      )
    } finally {
      setIsSubmitting(false)
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
        disabled={isSubmitting}
        required
      />
      <FeedMeField
        id="signup-password"
        name="password"
        label="Password"
        type="password"
        placeholder="********"
        autoComplete="new-password"
        disabled={isSubmitting}
        required
      />
      <FeedMeField
        id="confirm-password"
        name="confirmPassword"
        label="Confirm password"
        type="password"
        placeholder="********"
        autoComplete="new-password"
        disabled={isSubmitting}
        required
      />

      {errorMessage ? (
        <p role="alert" className="text-body-3 font-medium text-destructive">
          {errorMessage}
        </p>
      ) : null}

      <AuthButton type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Creating account..." : "Create account"}
      </AuthButton>
    </form>
  )
}
