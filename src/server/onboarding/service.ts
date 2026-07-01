import { eq } from "drizzle-orm"

import { db } from "@/db"
import { userProfiles } from "@/db/schema"
import { ValidationError } from "@/server/http/errors"
import type {
  ProfileInput,
  WorkspaceOnboardingInput,
} from "@/server/onboarding/validation"
import {
  createOwnedWorkspace,
  getDefaultWorkspaceForUser,
  type WorkspaceSummary,
} from "@/server/workspaces/service"

export type OnboardingState = {
  profileComplete: boolean
  hasWorkspace: boolean
  nextStep: "profile" | "workspace" | "complete"
  nextPath: string
  defaultWorkspace: WorkspaceSummary | null
}

export function deriveDisplayName(fullName: string, displayName?: string) {
  const trimmedDisplayName = displayName?.trim()

  if (trimmedDisplayName) {
    return trimmedDisplayName
  }

  return fullName.trim().split(/\s+/)[0] || fullName.trim()
}

export async function upsertUserProfile(userId: string, input: ProfileInput) {
  const displayName = deriveDisplayName(input.fullName, input.displayName)
  const [profile] = await db
    .insert(userProfiles)
    .values({
      userId,
      fullName: input.fullName,
      displayName,
      title: input.title ?? null,
    })
    .onConflictDoUpdate({
      target: userProfiles.userId,
      set: {
        fullName: input.fullName,
        displayName,
        title: input.title ?? null,
        updatedAt: new Date(),
      },
    })
    .returning({
      id: userProfiles.id,
      fullName: userProfiles.fullName,
      displayName: userProfiles.displayName,
      title: userProfiles.title,
      avatarUrl: userProfiles.avatarUrl,
      onboardingCompletedAt: userProfiles.onboardingCompletedAt,
    })

  return profile
}

async function getProfileCompletion(userId: string) {
  const [profile] = await db
    .select({
      id: userProfiles.id,
      fullName: userProfiles.fullName,
      displayName: userProfiles.displayName,
      onboardingCompletedAt: userProfiles.onboardingCompletedAt,
    })
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId))
    .limit(1)

  return {
    profile,
    profileComplete: Boolean(profile?.fullName && profile.displayName),
  }
}

export async function getOnboardingStateForUser(userId: string): Promise<OnboardingState> {
  const [{ profileComplete }, defaultWorkspace] = await Promise.all([
    getProfileCompletion(userId),
    getDefaultWorkspaceForUser(userId),
  ])

  if (!profileComplete) {
    return {
      profileComplete: false,
      hasWorkspace: Boolean(defaultWorkspace),
      nextStep: "profile",
      nextPath: "/welcome",
      defaultWorkspace,
    }
  }

  if (!defaultWorkspace) {
    return {
      profileComplete: true,
      hasWorkspace: false,
      nextStep: "workspace",
      nextPath: "/welcome",
      defaultWorkspace: null,
    }
  }

  return {
    profileComplete: true,
    hasWorkspace: true,
    nextStep: "complete",
    nextPath: `/${defaultWorkspace.slug}/reports`,
    defaultWorkspace,
  }
}

export async function getPostAuthRedirectPath(userId: string) {
  const state = await getOnboardingStateForUser(userId)

  return state.nextPath
}

export async function completeWorkspaceOnboarding(
  userId: string,
  input: WorkspaceOnboardingInput
) {
  const existingWorkspace = await getDefaultWorkspaceForUser(userId)

  if (existingWorkspace) {
    return {
      workspace: existingWorkspace,
      nextPath: `/${existingWorkspace.slug}/reports`,
    }
  }

  const { profileComplete } = await getProfileCompletion(userId)

  if (!profileComplete) {
    throw new ValidationError("Complete your profile before creating a workspace.", {
      fullName: ["Complete your profile before creating a workspace."],
    })
  }

  const workspace = await createOwnedWorkspace(userId, input, {
    completeOnboarding: true,
  })

  return {
    workspace,
    nextPath: `/${workspace.slug}/reports`,
  }
}
