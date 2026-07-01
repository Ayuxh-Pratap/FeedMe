"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { FormEvent, useState } from "react"

import {
  AuthButton,
  FeedMeField,
} from "@/components/feedme/auth-ui"
import { ApiClientError, postJson } from "@/lib/api-client"

type AuthResponse = {
  user: {
    id: string
    email: string
  }
  nextPath: string
}

function formValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "")
}

export function LoginForm() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSubmitting(true)
    setErrorMessage(null)

    const formData = new FormData(event.currentTarget)

    try {
      const result = await postJson<AuthResponse>("/api/auth/login", {
        email: formValue(formData, "email"),
        password: formValue(formData, "password"),
      })

      router.push(result.nextPath)
      router.refresh()
    } catch (error) {
      setErrorMessage(
        error instanceof ApiClientError
          ? error.message
          : "Unable to log in. Please try again."
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <FeedMeField
        id="email"
        name="email"
        label="Email"
        type="email"
        placeholder="your@workemail.com"
        autoComplete="email"
        disabled={isSubmitting}
        required
      />

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label htmlFor="password" className="text-body-3 font-medium text-foreground">
            Password
          </label>
          <Link
            href="/login"
            className="text-body-3 text-muted-foreground hover:text-text-secondary"
          >
            Forgot password?
          </Link>
        </div>
        <FeedMeField
          id="password"
          name="password"
          type="password"
          placeholder="********"
          autoComplete="current-password"
          disabled={isSubmitting}
          required
        />
      </div>

      {errorMessage ? (
        <p role="alert" className="text-body-3 font-medium text-destructive">
          {errorMessage}
        </p>
      ) : null}

      <AuthButton type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Logging in..." : "Log in"}
      </AuthButton>
    </form>
  )
}
