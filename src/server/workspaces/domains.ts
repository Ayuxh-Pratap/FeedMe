import { ValidationError } from "@/server/http/errors"

export const MAX_DOMAINS_PER_WORKSPACE = 5

const DOMAIN_PATTERN =
  /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/

export function normalizeDomainHost(input: string) {
  const value = input.trim()

  if (!value) {
    throw new ValidationError("Enter the first domain.", {
      firstDomain: ["Enter the first domain."],
    })
  }

  if (value.includes("*")) {
    throw new ValidationError("Wildcard domains are not supported in MVP.", {
      firstDomain: ["Wildcard domains are not supported in MVP."],
    })
  }

  let parsedUrl: URL

  try {
    const hasProtocol = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(value)
    parsedUrl = new URL(hasProtocol ? value : `https://${value}`)
  } catch {
    throw new ValidationError("Enter a valid domain, like v2.bump.fm.", {
      firstDomain: ["Enter a valid domain, like v2.bump.fm."],
    })
  }

  const host = parsedUrl.hostname.toLowerCase()

  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host === "127.0.0.1" ||
    host.startsWith("127.") ||
    host === "::1"
  ) {
    throw new ValidationError("Localhost domains are not supported in MVP.", {
      firstDomain: ["Localhost domains are not supported in MVP."],
    })
  }

  if (!DOMAIN_PATTERN.test(host)) {
    throw new ValidationError("Enter an exact domain, like v2.bump.fm.", {
      firstDomain: ["Enter an exact domain, like v2.bump.fm."],
    })
  }

  return host
}
