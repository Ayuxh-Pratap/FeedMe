# Security Policy

## Supported Version

Security fixes target the latest commit on `main`. This public V1 is provided without a hosted-service guarantee or long-term support schedule.

## Reporting A Vulnerability

Please use GitHub's private vulnerability reporting or security advisory flow for this repository. Do not include credentials, access tokens, private report content, or exploitable details in a public issue.

Include:

- the affected route, feature, or commit;
- reproduction steps with non-sensitive test data;
- the expected and observed authorization boundary;
- likely impact;
- any suggested mitigation.

## Deployment Security

- Use `AUTH_MODE=verified` for identity-sensitive or production deployments. Demo mode does not prove email ownership.
- Generate strong, unique values for database, Cloudinary, Resend, and internal worker secrets.
- Keep `CLOUDINARY_API_SECRET`, `RESEND_API_KEY`, `DATABASE_URL`, `INTERNAL_OPERATIONS_SECRET`, and FeedMe PATs server-side and out of source control.
- Rotate a secret immediately if it appears in logs, screenshots, commits, issues, or shared configuration.
- Run only the committed database migrations and back up production data before schema changes.
- Restrict the extension to the intended dashboard and upload origins when producing a self-hosted build.
- Keep dependency and platform security updates current.

CI treats `npm audit --omit=dev` as the deployable dependency gate. The full development tree may inherit advisories from code-generation and UI CLIs before those projects publish compatible upgrades. Development tools are not part of the production bundle, but they should only run against trusted repository content and should be upgraded when supported fixes become available.

FeedMe includes server-side role checks, workspace-scoped personal access tokens, hashed sessions and PATs, upload validation, security headers, request rate limits, and durable notification/auth-email outboxes. These controls reduce risk but do not replace an operator's infrastructure, logging, backup, monitoring, and incident-response responsibilities.
