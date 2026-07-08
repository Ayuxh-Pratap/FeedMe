"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { FormEvent, useState } from "react"

import {
  AuthButton,
  AuthHeading,
  ContinueIcon,
  FeedMeField,
} from "@/components/feedme/auth-ui"
import { ApiClientError, postJson } from "@/lib/api-client"

type CreateWorkspaceResponse = {
  workspace: {
    id: string
    name: string
    slug: string
  }
  nextPath: string
}

type NewWorkspaceFormProps = {
  backHref: string
}

function formValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "")
}

export function NewWorkspaceForm({ backHref }: NewWorkspaceFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isRedirecting, setIsRedirecting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const isBusy = isSubmitting || isRedirecting

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (isBusy) {
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)

    const formData = new FormData(event.currentTarget)

    try {
      const result = await postJson<CreateWorkspaceResponse>("/api/workspaces", {
        workspaceName: formValue(formData, "workspaceName"),
        firstDomain: formValue(formData, "firstDomain"),
      })

      setIsRedirecting(true)
      router.push(result.nextPath)
      router.refresh()
    } catch (error) {
      setErrorMessage(
        error instanceof ApiClientError
          ? error.message
          : "Unable to create your workspace. Please try again."
      )
      setIsSubmitting(false)
      setIsRedirecting(false)
    }
  }

  return (
    <section>
      <AuthHeading
        title="Create a workspace"
        description="Add a new team space with its first capture domain."
      />

      <form className="space-y-5" onSubmit={handleSubmit}>
        <FeedMeField
          id="workspace-name"
          name="workspaceName"
          label="Workspace name"
          placeholder="Your team workspace"
          autoComplete="organization"
          disabled={isBusy}
          required
        />
        <FeedMeField
          id="workspace-domain"
          name="firstDomain"
          label="First domain"
          placeholder="app.yourcompany.com"
          helper="Add the first website where this workspace will capture feedback. You can add and manage domains later."
          autoComplete="url"
          disabled={isBusy}
          required
        />

        {errorMessage ? (
          <p role="alert" className="text-body-3 font-medium text-destructive">
            {errorMessage}
          </p>
        ) : null}

        <AuthButton type="submit" className="mt-2 w-full" disabled={isBusy}>
          {isRedirecting
            ? "Opening workspace..."
            : isSubmitting
              ? "Creating workspace..."
              : "Create workspace"}
          {!isBusy ? <ContinueIcon /> : null}
        </AuthButton>
      </form>

      <div className="mt-6 text-center">
        <Link
          href={backHref}
          className="text-body-3 text-text-muted transition-colors hover:text-text-secondary"
        >
          Back to dashboard
        </Link>
      </div>
    </section>
  )
}
