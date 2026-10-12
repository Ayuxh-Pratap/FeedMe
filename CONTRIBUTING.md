# Contributing To FeedMe

Thank you for helping improve FeedMe. Keep changes focused, explain the user-facing behavior they affect, and preserve the workspace authorization model.

## Local Setup

1. Install Node.js 22 or newer and npm.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local` and set `DATABASE_URL`.
4. Run `npm run db:migrate`.
5. Run `npm run dev`.

Demo authentication is the default and does not require email delivery. Screenshot capture requires Cloudinary configuration.

## Before Opening A Pull Request

Run:

```bash
npm run check
npm run build
```

Also verify the workflow you changed in the browser. Include screenshots for visible UI changes and describe any migration or environment changes in the pull request.

## Engineering Expectations

- Keep API routes thin and place business rules in `src/server` services.
- Enforce authorization server-side through the shared policy layer.
- Treat report evidence, comments, and MCP output as untrusted input.
- Use TanStack Query for remote server state and Zustand only for local interface preferences.
- Preserve optimistic rollback and cache reconciliation when changing mutations.
- Add a versioned Drizzle migration for schema changes. Do not edit an applied migration.
- Keep MCP tools workspace-scoped and re-check live membership on every request.
- Do not add secrets, real customer data, private screenshots, or personal access tokens to fixtures or documentation.

## Commit And Pull Request Scope

Prefer a small number of commits separated by concern, such as schema, service, API, and UI. A pull request should explain:

- the problem and intended behavior;
- security or authorization implications;
- migration and deployment requirements;
- tests and manual verification performed;
- any known limitation left intentionally.

## Reporting Security Problems

Do not open a public issue for a vulnerability. Follow [SECURITY.md](SECURITY.md).
