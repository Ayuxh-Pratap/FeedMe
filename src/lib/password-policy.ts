const commonPasswords = new Set([
  "12345678",
  "123456789",
  "password",
  "password1",
  "password12",
  "password123",
  "qwerty123",
  "feedme123",
  "admin123",
  "letmein123",
])

export type PasswordRequirement = {
  id: "length" | "letter" | "number" | "common"
  label: string
  test: (password: string) => boolean
}

export const passwordRequirements: PasswordRequirement[] = [
  {
    id: "length",
    label: "Use at least 8 characters.",
    test: (password) => password.length >= 8,
  },
  {
    id: "letter",
    label: "Include at least one letter.",
    test: (password) => /[a-z]/i.test(password),
  },
  {
    id: "number",
    label: "Include at least one number.",
    test: (password) => /\d/.test(password),
  },
  {
    id: "common",
    label: "Avoid common passwords.",
    test: (password) => !commonPasswords.has(normalizePassword(password)),
  },
]

export function getPasswordIssues(password: string) {
  return passwordRequirements
    .filter((requirement) => !requirement.test(password))
    .map((requirement) => requirement.label)
}

export function getPasswordPolicyMessage(password: string) {
  return getPasswordIssues(password)[0] ?? null
}

function normalizePassword(password: string) {
  return password.trim().toLowerCase()
}
