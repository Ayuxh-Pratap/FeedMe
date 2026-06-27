"use client"

import { useState } from "react"

import {
  AuthButton,
  AuthContentFrame,
  AuthHeading,
  ContinueIcon,
  FeedMeField,
  FeedMeUploadField,
  UploadLogoControl,
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
            <FeedMeField id="name" label="Name" defaultValue="Ayush Pratap Singh" />
            <FeedMeField
              id="display-name"
              label="Display Name"
              defaultValue="Ayush"
              helper="This could be your first name or a nickname"
            />
            <FeedMeField
              id="title"
              label="Your Title"
              placeholder="Product Designer, Founder, etc."
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
            <FeedMeField id="workspace-name" label="Workspace Name" placeholder="Acme Inc." />
            <FeedMeUploadField label="Company Logo">
              <UploadLogoControl />
            </FeedMeUploadField>
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
