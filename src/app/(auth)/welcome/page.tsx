"use client"

import { useState } from "react"

import {
  AuthButton,
  AuthContentFrame,
  AuthHeading,
  ContinueIcon,
  FeedMeField,
} from "@/components/feedme/auth-ui"
import { RouteTransitionLink } from "@/components/feedme/experience/route-transition-button"

type WelcomeStep = "account" | "workspace"

export default function WelcomePage() {
  const [step, setStep] = useState<WelcomeStep>("account")
  const isWorkspaceStep = step === "workspace"

  return (
    <AuthContentFrame>
      {!isWorkspaceStep ? (
        <section>
          <AuthHeading
            title="Let's set up your account"
            description="This is how your teammates will recognize you."
          />

          <form className="space-y-5">
            <FeedMeField
              id="name"
              label="Full name"
              placeholder="Ayush Pratap Singh"
              autoComplete="name"
              required
            />
            <FeedMeField
              id="display-name"
              label="Display name (optional)"
              placeholder="Ayush"
              helper="This could be your first name or a nickname"
              autoComplete="nickname"
            />
            <FeedMeField
              id="title"
              label="Your title (optional)"
              placeholder="Product Designer, Founder, etc."
              autoComplete="organization-title"
            />
            <AuthButton
              type="button"
              className="mt-2 w-full"
              onClick={() => setStep("workspace")}
            >
              Continue
            </AuthButton>
          </form>
        </section>
      ) : (
        <section>
          <AuthHeading
            title="Create your first workspace"
            description="Set up a workspace for your team and get started."
          />

          <form className="space-y-5">
            <FeedMeField
              id="workspace-name"
              label="Workspace name"
              placeholder="Bump"
              autoComplete="organization"
              required
            />
            <FeedMeField
              id="workspace-domain"
              label="First domain"
              placeholder="v2.bump.fm"
              helper="Add the first website where your team will capture feedback. You can add and manage domains later."
              autoComplete="url"
              required
            />
            <AuthButton type="button" className="mt-2 w-full">
              Create workspace
              <ContinueIcon />
            </AuthButton>
          </form>

          <div className="mt-8 flex items-center justify-between text-caption text-muted-foreground">
            <span>Signed in as ayushpratapsingh@gmail.com</span>
            <RouteTransitionLink href="/login" className="hover:text-text-secondary">
              Log out
            </RouteTransitionLink>
          </div>
        </section>
      )}
    </AuthContentFrame>
  )
}
