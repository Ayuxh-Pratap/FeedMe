"use client"

import { useRouter } from "next/navigation"
import { FormEvent, useEffect, useState } from "react"

import {
  AuthButton,
  AuthHeading,
  ContinueIcon,
  FeedMeField,
} from "@/components/feedme/auth-ui"
import { ApiClientError, getJson, postJson } from "@/lib/api-client"

type WelcomeStep = "profile" | "workspace"

type OnboardingStateResponse = {
  user: {
    id: string
    email: string
  }
  profile: {
    fullName: string
    displayName: string
    title: string | null
  } | null
  onboarding: {
    nextStep: "profile" | "workspace" | "complete"
    nextPath: string
  }
  nextPath: string
}

type WorkspaceResponse = {
  workspace: {
    id: string
    name: string
    slug: string
  }
  nextPath: string
}

function formValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "")
}

export function WelcomeForm() {
  const router = useRouter()
  const [step, setStep] = useState<WelcomeStep>("profile")
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [email, setEmail] = useState("")
  const [profileDefaults, setProfileDefaults] = useState({
    fullName: "",
    displayName: "",
    title: "",
  })

  useEffect(() => {
    let isMounted = true

    async function loadState() {
      try {
        const result = await getJson<OnboardingStateResponse>("/api/onboarding/state")

        if (!isMounted) {
          return
        }

        if (result.onboarding.nextStep === "complete") {
          router.replace(result.nextPath)
          return
        }

        setEmail(result.user.email)
        setStep(result.onboarding.nextStep === "workspace" ? "workspace" : "profile")
        setProfileDefaults({
          fullName: result.profile?.fullName ?? "",
          displayName: result.profile?.displayName ?? "",
          title: result.profile?.title ?? "",
        })
      } catch (error) {
        if (error instanceof ApiClientError && error.code === "UNAUTHORIZED") {
          router.replace("/login")
          return
        }

        if (isMounted) {
          setErrorMessage("Unable to load onboarding. Please refresh and try again.")
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadState()

    return () => {
      isMounted = false
    }
  }, [router])

  const handleProfileSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSubmitting(true)
    setErrorMessage(null)

    const formData = new FormData(event.currentTarget)

    try {
      await postJson("/api/onboarding/profile", {
        fullName: formValue(formData, "fullName"),
        displayName: formValue(formData, "displayName"),
        title: formValue(formData, "title"),
      })

      setStep("workspace")
    } catch (error) {
      setErrorMessage(
        error instanceof ApiClientError
          ? error.message
          : "Unable to save your profile. Please try again."
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleWorkspaceSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSubmitting(true)
    setErrorMessage(null)

    const formData = new FormData(event.currentTarget)

    try {
      const result = await postJson<WorkspaceResponse>("/api/onboarding/workspace", {
        workspaceName: formValue(formData, "workspaceName"),
        firstDomain: formValue(formData, "firstDomain"),
      })

      router.push(result.nextPath)
      router.refresh()
    } catch (error) {
      setErrorMessage(
        error instanceof ApiClientError
          ? error.message
          : "Unable to create your workspace. Please try again."
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleLogout = async () => {
    setIsSubmitting(true)
    await postJson<{ nextPath: string }>("/api/auth/logout")
    router.push("/login")
    router.refresh()
  }

  if (isLoading) {
    return (
      <section>
        <AuthHeading
          title="Preparing your workspace"
          description="Checking where to continue."
        />
      </section>
    )
  }

  if (step === "profile") {
    return (
      <section>
        <AuthHeading
          title="Let's set up your account"
          description="This is how your teammates will recognize you."
        />

        <form className="space-y-5" onSubmit={handleProfileSubmit}>
          <FeedMeField
            id="name"
            name="fullName"
            label="Full name"
            placeholder="Ayush Pratap Singh"
            defaultValue={profileDefaults.fullName}
            autoComplete="name"
            disabled={isSubmitting}
            required
          />
          <FeedMeField
            id="display-name"
            name="displayName"
            label="Display name (optional)"
            placeholder="Ayush"
            defaultValue={profileDefaults.displayName}
            helper="This could be your first name or a nickname"
            autoComplete="nickname"
            disabled={isSubmitting}
          />
          <FeedMeField
            id="title"
            name="title"
            label="Your title (optional)"
            placeholder="Product Designer, Founder, etc."
            defaultValue={profileDefaults.title}
            autoComplete="organization-title"
            disabled={isSubmitting}
          />

          {errorMessage ? (
            <p role="alert" className="text-body-3 font-medium text-destructive">
              {errorMessage}
            </p>
          ) : null}

          <AuthButton type="submit" className="mt-2 w-full" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Continue"}
          </AuthButton>
        </form>
      </section>
    )
  }

  return (
    <section>
      <AuthHeading
        title="Create your first workspace"
        description="Set up a workspace for your team and get started."
      />

      <form className="space-y-5" onSubmit={handleWorkspaceSubmit}>
        <FeedMeField
          id="workspace-name"
          name="workspaceName"
          label="Workspace name"
          placeholder="Bump"
          autoComplete="organization"
          disabled={isSubmitting}
          required
        />
        <FeedMeField
          id="workspace-domain"
          name="firstDomain"
          label="First domain"
          placeholder="v2.bump.fm"
          helper="Add the first website where your team will capture feedback. You can add and manage domains later."
          autoComplete="url"
          disabled={isSubmitting}
          required
        />

        {errorMessage ? (
          <p role="alert" className="text-body-3 font-medium text-destructive">
            {errorMessage}
          </p>
        ) : null}

        <AuthButton type="submit" className="mt-2 w-full" disabled={isSubmitting}>
          {isSubmitting ? "Creating workspace..." : "Create workspace"}
          {!isSubmitting ? <ContinueIcon /> : null}
        </AuthButton>
      </form>

      <div className="mt-8 flex items-center justify-between gap-4 text-caption text-muted-foreground">
        <span className="min-w-0 truncate">Signed in as {email}</span>
        <button
          type="button"
          onClick={handleLogout}
          disabled={isSubmitting}
          className="shrink-0 hover:text-text-secondary disabled:cursor-not-allowed disabled:opacity-60"
        >
          Log out
        </button>
      </div>
    </section>
  )
}
