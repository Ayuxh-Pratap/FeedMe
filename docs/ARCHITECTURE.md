# FeedMe Architecture

This document describes the deployed system boundaries and the invariants that contributors should preserve. It is a reference for the current implementation, not a roadmap.

## System Boundaries

```mermaid
flowchart TB
  Browser[Dashboard browser] --> Next[Next.js application]
  Extension[Chromium extension] --> Upload[Signed Cloudinary upload]
  Extension --> Next
  Agent[MCP client] --> MCP[/api/mcp]
  MCP --> Next
  Next --> DB[(PostgreSQL)]
  Next --> Cloudinary[Cloudinary]
  Next --> Resend[Resend]
  Scheduler[Trusted scheduler] --> Worker[Outbox worker]
  Worker --> DB
  Worker --> Resend
```

The Next.js application owns pages, API routes, authentication, authorization, validation, workflow services, MCP transport, and upload signing. PostgreSQL is the system of record. Cloudinary stores screenshot evidence; the database stores validated HTTPS asset metadata, never screenshot data URLs.

## Layering

| Layer | Responsibility |
| --- | --- |
| `src/app` | Routing, server entry points, metadata, and thin API handlers |
| `src/components/feedme` | Product UI and interaction orchestration |
| `src/lib` | Shared contracts, query keys, client fetchers, cache mutations, and workflow helpers |
| `src/server` | Authorization-aware business services and external integrations |
| `src/db` | Drizzle schema and database connection |
| `drizzle` | Ordered, reviewable schema migrations |

API and MCP handlers should validate transport input, resolve the caller, delegate to a server service, and translate known application errors. Business rules should not be duplicated in route files or client components.

## Identity And Authorization

Dashboard sessions and MCP personal access tokens are separate credentials:

- Session and PAT plaintext values are returned only to the client that created them.
- Only hashes are stored in PostgreSQL.
- A PAT belongs to one user and one workspace.
- Every protected request resolves the current user, active membership, workspace, and live role.
- Role permissions are enforced in the shared policy and service layers, not only by hiding controls.

Demo authentication skips email ownership verification. Verified authentication uses single-use action tokens and a durable email outbox. Both modes share the same session and workspace authorization model after login.

## Report Data Contracts

FeedMe separates list summaries from complete report details:

- List endpoints return the fields needed by tables, filters, counts, and lightweight navigation.
- Detail reads return evidence, implementation brief, notes, status history, comments, and assignment context.
- Images remain external Cloudinary assets and are loaded only where needed.
- Pagination is server-driven for report lists and comment trees.

This separation keeps the initial queue responsive while preserving a complete report handoff when the rail, detail page, or MCP client needs it.

## Client State

TanStack Query owns remote server state. Query keys include workspace and filter identity so data cannot bleed between queues. Mutations optimistically update relevant detail, list, count, and member caches, then reconcile with the server result. Background polling updates stale data without replacing warm content with a blocking skeleton.

Zustand is intentionally limited to local interface preferences such as selected dashboard context. Reports, users, memberships, notifications, and tokens must not become an independent Zustand copy of server state.

## Workflow And Concurrency

The server is authoritative for assignment and status transitions. Services use guarded writes and database transactions where multiple records must agree. Important workflow changes append status events. Report creation and other retryable writes use idempotency controls so a network retry cannot silently duplicate work.

Comment deletion is soft deletion when thread shape must be preserved. The rendered cache applies pending deletions at every write boundary so refetches and pagination cannot resurrect deleted content.

## Notifications And Outboxes

Workflow actions commit notification intent to a durable outbox instead of relying on a best-effort side effect after the main write. The trusted worker processes pending notification and auth-email deliveries, retries transient failures, exposes health, and prunes expired rate-limit buckets.

Run the worker at least every five minutes:

```http
GET /api/internal/notification-worker
Authorization: Bearer <INTERNAL_OPERATIONS_SECRET>
```

## Media Trust Boundary

The extension requests a short-lived upload signature from the dashboard, uploads directly to Cloudinary, then submits only hosted asset metadata with the report. Server validation restricts assets to the configured cloud and folder. MCP image loading re-validates URLs and rejects redirects, non-image content, and oversized responses.

## MCP Trust Boundary

MCP output contains user-authored report text and captured webpage content. Agent guidance treats that evidence as data, not instructions. Tools are constrained by workspace-scoped PAT permissions and call the same service layer as dashboard APIs.

## Operational Invariants

- Never trust a workspace slug, report id, member id, or asset URL without authorization and validation.
- Never return a stored credential hash or log a plaintext credential.
- Never place heavy evidence payloads in list endpoints.
- Never let a client-side optimistic state override a server authorization or workflow failure.
- Never ship a schema change without a committed migration and rollout note.
- Never make notification delivery part of a request's only success path.
