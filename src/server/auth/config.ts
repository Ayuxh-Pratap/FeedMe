export type AuthMode = "demo" | "verified"

const DEFAULT_DEMO_EMAIL = "demo.admin@feedme.app"
const DEFAULT_DEMO_PASSWORD = "FeedMeDemo123"

type AuthEnvironment = Record<string, string | undefined>

export function getAuthMode(env: AuthEnvironment = process.env): AuthMode {
  const configuredMode = env.AUTH_MODE?.trim().toLowerCase()

  if (!configuredMode) return "demo"
  if (configuredMode === "demo" || configuredMode === "verified") {
    return configuredMode
  }

  throw new Error('AUTH_MODE must be either "demo" or "verified".')
}

export function isEmailVerificationRequired(
  env: AuthEnvironment = process.env
) {
  return getAuthMode(env) === "verified"
}

export function getDemoAccountCredentials(
  env: AuthEnvironment = process.env
) {
  return {
    email: env.DEMO_ACCOUNT_EMAIL?.trim() || DEFAULT_DEMO_EMAIL,
    password: env.DEMO_ACCOUNT_PASSWORD || DEFAULT_DEMO_PASSWORD,
  }
}
