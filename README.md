# FeedMe

FeedMe is a workspace-first visual feedback and implementation handoff system for product teams. It turns feedback captured on a live website into structured reports that can be triaged, assigned, discussed, and completed by developers or designers. An MCP server gives coding agents the same report context and workflow controls.

[![CI](https://github.com/Ayuxh-Pratap/FeedMe-Dashboard/actions/workflows/ci.yml/badge.svg)](https://github.com/Ayuxh-Pratap/FeedMe-Dashboard/actions/workflows/ci.yml)

[Live demo](https://meefeed.vercel.app) | [Architecture](docs/ARCHITECTURE.md) | [MCP guide](docs/MCP.md) | [Extension guide](docs/EXTENSION.md) | [Deployment guide](docs/DEPLOYMENT.md)

> [!IMPORTANT]
> The hosted site is a public product demo and portfolio project, not a managed production SaaS service. Demo mode intentionally accepts any correctly formatted email without proving ownership. Self-host with `AUTH_MODE=verified` and your own infrastructure before using FeedMe for sensitive or production data.

## What FeedMe Solves

Bug reports often lose the context that made them useful: the exact page, selected element, screenshot, viewport, expected result, and the conversation that followed. FeedMe keeps that context attached to the work from capture through review.

```mermaid
flowchart LR
  A[Capture on a website] --> B[Workspace report]
  B --> C[Triage and implementation brief]
  C --> D[Assign developer or designer]
  D --> E[Work notes and clarification]
  E --> F[Ready for review]
  F --> G[Resolved]
  B --> H[MCP context pack]
  H --> I[Coding agent]
```

## Product Capabilities

- **Visual capture:** Browser extension capture for page and element screenshots, source URL, selected element, browser, and viewport context.
- **Workspace routing:** Domain-based workspaces, invitations, membership roles, and scoped access.
- **Report operations:** Server-side filtering, sorting, pagination, report counts, fast detail loading, and cached navigation.
- **Assignment workflow:** Assign work to developers or designers, start work, request clarification, record blockers, submit for review, and resolve.
- **Implementation handoff:** Optional acceptance criteria, implementation notes, constraints, expected behavior, reference links, and review checklist.
- **Team discussion:** Threaded comments, replies, mentions, activity notes, durable notifications, and deep links to a specific comment.
- **Optimistic UX:** Immediate assignment, status, note, comment, and deletion feedback with cache reconciliation.
- **Agent workflow:** Workspace-scoped MCP tokens, structured context packs, queue tools, safe workflow mutations, bulk task import, and task presets.
- **Public demo mode:** Frictionless signup and an optional shared demo account without removing the production verification flow.

## Roles And Workflow

FeedMe supports `owner`, `admin`, `developer`, `designer`, `reporter`, and `viewer` memberships. Owners and admins manage the workspace, implementation briefs, assignments, and review. Developers and designers can act on work assigned to them. Every API and MCP operation re-checks the caller's active workspace membership and role.

The implementation path is:

```text
submitted -> assigned -> in_progress -> ready_for_review -> resolved
```

Triage states such as `needs_info`, `duplicate`, and `rejected` are also represented without overloading the developer queue.

## Stack

| Area | Technology |
| --- | --- |
| Application | Next.js 16 App Router, React 19, TypeScript |
| UI | Tailwind CSS 4, Base UI/Radix primitives, Lucide |
| Data | PostgreSQL, Drizzle ORM, Neon serverless driver |
| Client state | TanStack Query for server state, Zustand for local dashboard preferences |
| Validation | Zod |
| Media | Cloudinary signed direct uploads |
| Agent integration | Model Context Protocol through `mcp-handler` |
| Email | Resend in verified-auth mode |
| Deployment | Vercel-compatible Node.js runtime |

## Quick Start

### Requirements

- Node.js 22 or newer
- npm
- A PostgreSQL database reachable through `DATABASE_URL`
- A Cloudinary account if you want screenshot capture
- A Resend account only if you enable verified email authentication

### 1. Clone And Install

```bash
git clone https://github.com/Ayuxh-Pratap/FeedMe-Dashboard.git
cd FeedMe-Dashboard
npm install
```

### 2. Configure The Environment

Copy `.env.example` to `.env.local`, then set at least the database URL.

```bash
cp .env.example .env.local
```

On PowerShell:

```powershell
Copy-Item .env.example .env.local
```

Minimal local configuration:

```dotenv
DATABASE_URL=postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require
AUTH_MODE=demo
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### 3. Apply The Database Migrations

```bash
npm run db:migrate
```

### 4. Start FeedMe

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), create an account, finish the profile and workspace flow, and add the domain you want to capture feedback from.

## Authentication Modes

### Demo Mode

`AUTH_MODE=demo` is the default when the variable is absent. Signup validates email shape and password strength, creates the account, and starts a session without sending email. It does **not** verify ownership of the address.

The login screen can also fill a shared demo identity from:

```dotenv
DEMO_ACCOUNT_EMAIL=demo.admin@feedme.app
DEMO_ACCOUNT_PASSWORD=FeedMeDemo123
```

The credentials are intentionally sent to the browser and must be treated as public. Create that account once through the normal signup flow and populate it with non-sensitive sample data. Never reuse a real password.

### Verified Mode

Use `AUTH_MODE=verified` for a real deployment. Configure `RESEND_API_KEY`, `AUTH_EMAIL_FROM`, `NEXT_PUBLIC_SITE_URL`, and `INTERNAL_OPERATIONS_SECRET`. Signup then remains sessionless until the user verifies the email address. Password reset, password change, session management, and the durable email outbox remain available in the codebase.

See [Deployment](docs/DEPLOYMENT.md) for the full variable and worker checklist.

## Browser Extension

The hosted dashboard exposes a packaged Chromium extension at [`public/downloads/feedme-extension.zip`](public/downloads/feedme-extension.zip). Until the extension is published in the Chrome Web Store:

1. Download and unzip the archive.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Choose **Load unpacked** and select the extracted folder.
5. Log in to FeedMe, add the target website domain to a workspace, and capture from that site.

The packaged build targets the hosted FeedMe origin. The extension source is maintained separately and is not part of this dashboard repository, so self-hosters must build a matching extension with their own dashboard origin. The trust model and permissions are documented in [Extension](docs/EXTENSION.md).

## MCP And Coding Agents

FeedMe exposes a Streamable HTTP MCP endpoint at:

```text
https://YOUR_FEEDME_ORIGIN/api/mcp
```

From the dashboard, open **Connect agent**, create a named personal access token, and copy the generated configuration. A generic client configuration looks like:

```json
{
  "mcpServers": {
    "feedme": {
      "url": "https://YOUR_FEEDME_ORIGIN/api/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_FEEDME_PAT"
      }
    }
  }
}
```

Tokens are workspace-scoped, only their hashes are stored, and the plaintext is shown once. The agent should begin with `whoami` and `get_feedme_guide`, then use exact queue tools instead of fetching every report and guessing.

Core tools include:

- `list_new_assigned_reports`, `list_in_progress_reports`, and `get_next_report`
- `get_report_context_pack` and `get_report`
- `start_work`, `add_work_note`, `mark_blocked`, `ask_for_clarification`, and `mark_ready_for_review`
- `list_assignable_members`, `assign_report`, and `bulk_create_tasks`

FeedMe also registers prompts for quick fixes, analysis-only work, full fixes, UI polish, tests, verification, PR summaries, and clarification. See [MCP](docs/MCP.md) for exact behavior and agent guidance.

## Environment Reference

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection string used by the app and Drizzle |
| `AUTH_MODE` | No | `demo` by default; set `verified` for email verification |
| `DEMO_ACCOUNT_EMAIL` | Demo only | Public shared account filled by the login screen |
| `DEMO_ACCOUNT_PASSWORD` | Demo only | Public shared account password; never use a real secret |
| `NEXT_PUBLIC_SITE_URL` | Recommended | Canonical origin for metadata and auth links |
| `NEXT_PUBLIC_ENABLE_AGENTATION` | No | Local feedback tooling toggle; leave `false` publicly |
| `CLOUDINARY_CLOUD_NAME` | Capture only | Cloudinary account name |
| `CLOUDINARY_API_KEY` | Capture only | Public Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Capture only | Server-only upload signing secret |
| `CLOUDINARY_UPLOAD_FOLDER` | No | Defaults to `feedme/reports` |
| `RESEND_API_KEY` | Verified auth | Server-only Resend key |
| `AUTH_EMAIL_FROM` | Verified auth | Verified sender identity |
| `INTERNAL_OPERATIONS_SECRET` | Recommended | Protects the outbox and maintenance worker endpoint |

Do not expose variables without the `NEXT_PUBLIC_` prefix to browser code. Never commit `.env`, `.env.local`, access tokens, database URLs, or provider secrets.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the local development server |
| `npm run build` | Create the production build |
| `npm run start` | Run the production server |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript without emitting files |
| `npm test` | Run the focused workflow and security tests |
| `npm run check` | Run lint, type checking, and tests |
| `npm run db:generate` | Generate a migration after schema changes |
| `npm run db:migrate` | Apply committed migrations |
| `npm run db:studio` | Open Drizzle Studio |
| `npm run db:reset` | Reset the configured database; destructive |
| `npm run assets:social` | Regenerate the generic public social preview images |

## Repository Layout

```text
src/app/                 Next.js pages, layouts, metadata, and API routes
src/components/feedme/   Product-specific UI and workflows
src/components/ui/       Shared UI primitives
src/lib/                 Client contracts, queries, workflow rules, and helpers
src/server/              Auth, policy, report, notification, upload, and MCP services
src/db/                  Drizzle schema and database connection
drizzle/                 Versioned PostgreSQL migrations
public/downloads/        Packaged extension download
docs/                    Public architecture and operator documentation
```

## Production Notes

- Run database migrations as an explicit release step. Do not generate or push schema changes during a production build.
- Schedule `GET /api/internal/notification-worker` with `Authorization: Bearer $INTERNAL_OPERATIONS_SECRET` at least every five minutes.
- Use verified auth for real users. Demo mode is intentionally unsuitable for identity-sensitive data.
- Configure Cloudinary before enabling extension capture. The API validates image origin, account, folder, content type, redirects, and size.
- Keep the packaged extension and dashboard origin in sync.
- Review [SECURITY.md](SECURITY.md) before exposing a self-hosted instance publicly.

## Project Status

FeedMe is feature-complete as a public V1 portfolio project and can be self-hosted. It demonstrates a production-minded architecture, but the hosted demo carries no uptime, support, data-retention, or privacy guarantee. Chrome Web Store distribution and a hosted commercial service are outside the current scope.

## Contributing

Issues and focused pull requests are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) before changing workflow, authorization, schema, or MCP behavior. Security concerns should follow [SECURITY.md](SECURITY.md), not a public issue.

## License

FeedMe is available under the [MIT License](LICENSE).
