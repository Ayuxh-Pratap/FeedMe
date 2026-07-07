# FeedMe API Implementation Guide

This file defines how we should build the FeedMe backend so the code stays modular, readable, and production-friendly as the product grows.

Read this with:

- `AUTH_WORKSPACE_FLOW.md` for signup, login, onboarding, and first workspace creation.
- `integration.md` for workspace, dashboard, extension, domain, invite, and report behavior.
- `PROJECT_VISION.md` for the product shape we are protecting.
- `FRONTEND_DATA_ARCHITECTURE.md` for TanStack Query, Zustand, caching, optimistic updates, and production dashboard data rules.

## Readiness

We are ready to build APIs.

The foundation is now in place:

```txt
Next.js app
-> Neon Postgres
-> Drizzle schema
-> workspace-first data model
-> auth/workspace/domain/report flow docs
```

The next work should connect the current frontend to real backend behavior without letting route files become large business-logic files.

## Core Rule

Route handlers are transport glue only.

They should:

```txt
read request
validate input
load current session/user when needed
call a feature service
return a typed response
```

They should not:

```txt
contain large business rules
construct complex Drizzle queries inline
decide permissions directly
normalize domains in multiple places
generate workspace slugs in route files
```

## Recommended Folder Shape

Use `src/server` for backend-only application logic.

```txt
src/server/
  auth/
    password.ts
    sessions.ts
    current-user.ts
    validation.ts
    service.ts

  onboarding/
    validation.ts
    service.ts

  workspaces/
    validation.ts
    service.ts
    slugs.ts
    domains.ts

  invites/
    validation.ts
    service.ts

  policies/
    actions.ts
    can.ts

  http/
    errors.ts
    responses.ts

  db/
    transactions.ts optional later
```

Use `src/app/api/.../route.ts` for Next.js route handlers.

Example:

```txt
src/app/api/auth/signup/route.ts
src/app/api/auth/login/route.ts
src/app/api/auth/logout/route.ts
src/app/api/auth/session/route.ts

src/app/api/onboarding/state/route.ts
src/app/api/onboarding/profile/route.ts
src/app/api/onboarding/workspace/route.ts
```

Keep database schema and database client in:

```txt
src/db/schema.ts
src/db/index.ts
```

## Response Shape

Use one consistent API shape.

Success:

```json
{
  "ok": true,
  "data": {}
}
```

Failure:

```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Please check the highlighted fields.",
    "fieldErrors": {}
  }
}
```

`src/server/http/responses.ts` should own helpers like:

```txt
ok(data, init?)
fail(error, init?)
```

`src/server/http/errors.ts` should own typed application errors such as:

```txt
ValidationError
UnauthorizedError
ForbiddenError
ConflictError
NotFoundError
```

## Validation

Use Zod at every API boundary.

Validation files should live beside the feature:

```txt
src/server/auth/validation.ts
src/server/onboarding/validation.ts
src/server/workspaces/validation.ts
```

Business normalization must happen once in shared helpers.

Examples:

```txt
normalizeEmail(email)
deriveDisplayName(fullName, displayName)
normalizeDomainHost(input)
generateWorkspaceSlug(name)
```

Do not duplicate normalization inside UI components, route handlers, and services. The UI can format user input for convenience, but the server remains the source of truth.

## Auth And Sessions

For MVP, use email/password auth with first-party sessions.

Session behavior:

```txt
cookie name: feedme_session
cookie type: HttpOnly
cookie sameSite: none in production while the unpacked extension reuses the dashboard session
cookie secure: true in production
session token stored raw only in browser cookie
session token hash stored in database
session expiry: 30 days for MVP
```

Mutation trust guard:

```txt
all unsafe /api methods except /api/mcp pass through src/proxy.ts
dashboard writes send x-feedme-client: dashboard
extension writes send x-feedme-client: extension
dashboard writes must come from the dashboard origin
extension writes must come from an extension origin, or an extension context without Origin
JSON routes must use Content-Type: application/json
cross-site browser writes without the FeedMe client header are rejected before route handlers run
```

This guard exists because production cookies are `SameSite=None; Secure` for the
unpacked extension. Future architecture should move the extension to an
extension-scoped token/session so the dashboard cookie can return to
`SameSite=Lax`.

Password behavior:

```txt
never store plain passwords
hash passwords server-side
use a random salt per password
support future rehashing by storing the algorithm metadata in the hash string
```

Google login stays visible but disabled until we support OAuth.

## RBAC

Permission checks belong in `src/server/policies`.

Use code-defined actions first:

```txt
workspace:read
workspace:update
workspace:manage_domains
workspace:manage_members
workspace:create_invite

report:create
report:read
report:assign
report:update_status
report:mark_ready_for_review
report:resolve
report:comment
```

The API should call policy helpers instead of checking roles directly in every route.

Good:

```txt
assertCan(member, "workspace:manage_domains")
```

Avoid:

```txt
if (member.role === "owner" || member.role === "admin") ...
```

This keeps RBAC simple now while leaving room for database-backed custom permissions later.

## Workspace And Tenant Safety

Every workspace-owned query must be scoped by `workspaceId`.

Rules:

```txt
never trust workspaceSlug alone
resolve workspaceSlug to workspaceId
verify active membership
then query tenant data with workspaceId
```

Report child tables already include `workspaceId`. Use it in queries so comments, assets, and status events stay tenant-scoped without relying on accidental joins.

## Transaction Boundaries

Use database transactions for flows that must succeed or fail together.

Required transaction:

```txt
complete welcome workspace step
-> upsert profile
-> create workspace
-> create owner membership
-> create first domain
-> mark onboarding complete
```

Later transactions:

```txt
accept invite
create report with assets and initial status event
assign report and write status event
resolve report and write status event
```

## Initial API Build Order

Build the APIs in this order:

1. Auth helpers and HTTP helpers.
2. `POST /api/auth/signup`
3. `POST /api/auth/login`
4. `POST /api/auth/logout`
5. `GET /api/auth/session`
6. `GET /api/onboarding/state`
7. `POST /api/onboarding/profile`
8. `POST /api/onboarding/workspace`
9. Connect login, signup, and welcome UI to these APIs.
10. Add protected dashboard redirects based on real session and membership state.

After this flow works end to end, build:

```txt
workspace domains
invites
team members
reports
report submission foundation
extension bootstrap
extension report submission
```

## Implementation Progress

Keep this section updated as backend slices land. Each slice should list the contract, server modules, API routes, and testing commands.

### Slice 1: Auth And First Workspace

Status:

```txt
implemented
```

Scope:

```txt
email/password signup
email/password login
logout
session lookup
onboarding state
profile upsert
first workspace creation
first domain creation
creator owner membership
protected auth/welcome/dashboard route redirects
```

Routes:

```txt
POST /api/auth/signup
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/session

GET  /api/onboarding/state
POST /api/onboarding/profile
POST /api/onboarding/workspace
```

Important implementation note:

```txt
The app currently uses drizzle-orm/neon-http.
That driver does not support db.transaction(...).
For atomic multi-query writes over Neon HTTP, use db.batch(...), which maps to Neon HTTP's non-interactive transaction support.
```

### Slice 2: Workspace Domain Management

Status:

```txt
implemented
```

Goal:

```txt
Admins and owners can manage the exact domains where a workspace can capture feedback.
All active workspace members can read the domain list.
```

Routes:

```txt
GET    /api/workspaces/:workspaceSlug/domains
POST   /api/workspaces/:workspaceSlug/domains
DELETE /api/workspaces/:workspaceSlug/domains/:domainId
```

Server files:

```txt
src/server/workspaces/domains.ts
src/server/workspaces/validation.ts
src/server/workspaces/domain-service.ts
src/app/api/workspaces/[workspaceSlug]/domains/route.ts
src/app/api/workspaces/[workspaceSlug]/domains/[domainId]/route.ts
```

Dashboard wiring:

```txt
The workspace switcher Domains dialog uses these APIs directly.
Opening the dialog loads domains.
Adding a domain calls POST.
Removing a domain calls DELETE.
Server errors are shown inside the dialog.
```

Rules:

```txt
resolve workspaceSlug to workspaceId
require signed-in user
require active workspace membership
scope every domain query by workspaceId
allow read for workspace:read
allow add/delete for workspace:manage_domains
normalize domains through normalizeDomainHost(input)
store exact host only
block localhost and wildcard domains
enforce max 5 domains per workspace
return conflict for duplicate domain in the same workspace
existing reports remain historical if a domain is deleted later
```

Response examples:

```json
{
  "ok": true,
  "data": {
    "domains": []
  }
}
```

```json
{
  "ok": true,
  "data": {
    "domain": {
      "id": "domain_id",
      "host": "v2.bump.fm",
      "status": "active"
    }
  }
}
```

### Slice 3: Invite Links

Status:

```txt
implemented
```

Goal:

```txt
Owners and admins can create role-scoped invite links.
Invite links are not email-bound in MVP.
Invited users can inspect an invite code, sign in or sign up, accept the invite, and join the workspace.
```

Routes:

```txt
GET  /api/workspaces/:workspaceSlug/invites
POST /api/workspaces/:workspaceSlug/invites

GET  /api/invites/:inviteCode
POST /api/invites/:inviteCode/accept
```

UI routes:

```txt
/join/:inviteCode
```

Server files:

```txt
src/server/invites/validation.ts
src/server/invites/service.ts
src/app/api/workspaces/[workspaceSlug]/invites/route.ts
src/app/api/invites/[inviteCode]/route.ts
src/app/api/invites/[inviteCode]/accept/route.ts
```

UI files:

```txt
src/components/feedme/dashboard/invite-member-dialog.tsx
src/app/join/[inviteCode]/page.tsx
src/components/feedme/join/join-invite-panel.tsx
src/lib/safe-next-path.ts
```

Rules:

```txt
require signed-in user for creating invite links
require active workspace membership
allow create/list through workspace:create_invite
block invite creation if the workspace has zero active domains
do not bind invites to email in MVP
do not send emails in MVP
invite links carry a default role
invite links are single-use by default in MVP
invite creator cannot create owner invites
accepting an invite creates or reactivates workspace membership
accepting an invite increments usedCount
when usedCount reaches maxUses, mark the invite exhausted
accepting an invite redirects to the workspace dashboard if profile is complete
accepting an invite redirects to /welcome if profile is incomplete
```

Dashboard wiring:

```txt
The Team page invite dialog creates real invite links.
The role picker controls the invite role.
Copy code and copy invite link use the generated server invite.
Email invite sending remains future work.
Login and signup preserve a safe relative next path so invite links survive auth.
Switching between login and signup keeps that same next path.
```

### Slice 4: Team Members Read Model

Status:

```txt
implemented
```

Goal:

```txt
Workspace members can see the real team list from the database.
Invite acceptance becomes visible in the Team page and right rail.
Role editing and member removal are intentionally deferred to a later member-management slice.
```

Routes:

```txt
GET /api/workspaces/:workspaceSlug/members
```

Server files:

```txt
src/server/members/service.ts
src/app/api/workspaces/[workspaceSlug]/members/route.ts
src/lib/team-members.ts
```

UI files:

```txt
src/app/[workspaceSlug]/team/page.tsx
src/app/[workspaceSlug]/layout.tsx
src/components/feedme/dashboard/team-page.tsx
src/components/feedme/dashboard/workspace-shell.tsx
```

Rules:

```txt
require signed-in user
resolve workspaceSlug to workspaceId through active membership
allow member listing through workspace:read
scope every member query by workspaceId
exclude removed memberships from the live team list
return canonical DB role and status values
return UI-ready name, displayName, initials, joinedAtLabel, assignedCount, completedCount, and reportsCount
```

Dashboard wiring:

```txt
The Team page now reads real workspace memberships.
The Team right rail fetches the same member list from the API.
The workspace shell member count uses the real membership count.
Assigned, completed, and submitted report counts are wired to the reports table.
Assigned means active work; completed means resolved work owned by that teammate.
```

### Slice 5: Reports Read Model

Status:

```txt
implemented
```

Goal:

```txt
Workspace reports can be read from the database through tenant-scoped APIs.
The Reports page, report detail page, report right rail, and workspace report count now use real report rows.
Report creation, assignment, comments, and status mutations are intentionally deferred to later slices.
```

Routes:

```txt
GET /api/workspaces/:workspaceSlug/reports
GET /api/workspaces/:workspaceSlug/reports/:reportId
```

Server files:

```txt
src/server/reports/service.ts
src/server/reports/validation.ts
src/app/api/workspaces/[workspaceSlug]/reports/route.ts
src/app/api/workspaces/[workspaceSlug]/reports/[reportId]/route.ts
src/lib/reports.ts
```

UI files:

```txt
src/app/[workspaceSlug]/reports/page.tsx
src/app/[workspaceSlug]/reports/[reportId]/page.tsx
src/app/[workspaceSlug]/layout.tsx
src/components/feedme/dashboard/reports-list.tsx
src/components/feedme/dashboard/report-detail.tsx
src/components/feedme/dashboard/workspace-shell.tsx
src/components/feedme/dashboard/report-badge-styles.ts
```

Rules:

```txt
require signed-in user
resolve workspaceSlug to workspaceId through active membership
allow report reads through report:read
scope every report query by workspaceId
exclude archived reports from the main read model
validate reportId as UUID for detail reads
return DB lifecycle statuses directly: submitted, reviewing, assigned, in_progress, ready_for_review, resolved, and related terminal states
include reporter, assignee, commentsCount, selected element, viewport, feedback, and screenshot metadata in the UI view model
include report asset URLs and dimensions in list and detail read models so the reports page, grid cards, right rail, and detail page render real screenshots when available
```

Dashboard wiring:

```txt
The Reports page now renders DB reports or the empty state.
The report detail page now reads a DB report by workspace and report id.
The report right rail fetches the real report list while on /:workspaceSlug/reports.
The My Work route is connected in the assignment/report ownership slice.
The workspace shell report count uses the real non-archived report count.
```

### Slice 6: Report Submission Foundation

Status:

```txt
implemented
```

Goal:

```txt
Authenticated workspace members can create a report against an allowed workspace domain.
This gives the DB-backed Reports page real data before the extension is rebuilt.
The future extension submission endpoint should reuse this service instead of creating a second report-write path.
```

Routes:

```txt
POST /api/workspaces/:workspaceSlug/reports
```

Server files:

```txt
src/server/reports/service.ts
src/server/reports/validation.ts
src/app/api/workspaces/[workspaceSlug]/reports/route.ts
src/server/policies/can.ts
```

Rules:

```txt
require signed-in user
resolve workspaceSlug to workspaceId through active membership
allow report creation through report:create
all active workspace members can submit reports in MVP, including viewer
derive exact host from submitted url
block submission unless the exact host is active or verified in workspace_domains
create report with status submitted
create the initial report_status_events row in the same db.batch call
optionally create up to 3 report asset metadata rows with the report
report writes must include workspaceId on reports, assets, and status events
extension-created report writes must include at least one screenshot asset
```

Input shape:

```txt
url
title optional
summary optional
severity optional: low | medium | high | urgent
type optional: bug | ux | design | copy | performance | accessibility
browser optional
device optional
viewport: width, height, devicePixelRatio, scrollX, scrollY
selectedElement: tag, selector, text optional, attributes optional, boundingBox optional
feedbackMessage
developerPrompt optional
capturedAt optional
assets required: page_screenshot | element_screenshot | annotated_screenshot
```

Dashboard wiring:

```txt
Newly submitted reports appear in the Reports page, report right rail, report detail page, and workspace report count.
My Work is populated from reporter and assignee ownership in the assignment/report ownership slice.
Report assets are required for extension-created reports, saved as screenshot metadata, and surfaced back through the read model for immediate dashboard evidence rendering.
```

### Slice 6.5: Additional Workspace Creation

Status:

```txt
implemented
```

Goal:

```txt
Keep /welcome dedicated to first-run onboarding.
Let already-onboarded users create more workspaces from the dashboard without being bounced back by onboarding redirects.
Replace fake workspace switcher options with real active workspace memberships.
```

Routes:

```txt
GET  /api/workspaces
POST /api/workspaces
/workspaces/new
```

Server and UI files:

```txt
src/server/workspaces/service.ts
src/server/workspaces/validation.ts
src/server/onboarding/service.ts
src/server/onboarding/validation.ts
src/app/api/workspaces/route.ts
src/app/(auth)/workspaces/new/page.tsx
src/components/feedme/dashboard/new-workspace-form.tsx
src/app/[workspaceSlug]/layout.tsx
src/components/feedme/dashboard/workspace-shell.tsx
```

Rules:

```txt
/welcome creates only the first workspace
completed users who visit /welcome redirect to their default workspace
additional workspace creation uses /workspaces/new
additional workspace creation requires an authenticated, fully-onboarded user
workspace creation always creates workspace, owner membership, and first active domain together
POST /api/workspaces returns nextPath: /:workspaceSlug/reports
GET /api/workspaces returns the user's active workspace memberships
workspace switcher must render real memberships, not mock workspace names
```

### Slice 7: Extension Bootstrap

Status:

```txt
implemented
```

Goal:

```txt
Give the browser extension one backend-owned source of truth for the signed-in user,
workspace memberships, workspace domains, default active workspace, and capture permissions.
This prepares the copied v1 extension for the new workspace/domain flow without rewriting capture UI in the same slice.
```

Route:

```txt
GET /api/extension/bootstrap
```

Server files:

```txt
src/server/extension/service.ts
src/app/api/extension/bootstrap/route.ts
```

Extension files:

```txt
extension/src/services/bootstrapApi.ts
extension/src/storage/extensionStorage.ts
extension/src/popup/PopupApp.tsx
extension/entrypoints/popup/style.css
extension/entrypoints/content/index.tsx
extension/src/content/ContentApp.tsx
extension/entrypoints/background.ts
extension/src/services/reportsApi.ts
extension/src/services/reportSync.ts
extension/src/shared/feedback.ts
extension/wxt.config.ts
```

Response shape:

```txt
user
activeWorkspaceSlug
workspaces[]
  id
  name
  slug
  logoUrl
  role
  isDefault
  permissions.canCreateReports
  domains[]
    id
    host
    status
    captureEnabled
    verifiedAt
```

Rules:

```txt
require signed-in user
return only active workspace memberships
exclude archived workspaces
include domains per workspace
mark active and verified domains as captureEnabled
do not trust this payload for writes; report submission must validate membership and domain again
```

Extension note:

```txt
The popup now uses bootstrap data for signed-in user identity, active workspace selection,
and per-domain permission state. The content script reads cached bootstrap state and hides the
floating button unless the current host belongs to the active workspace. Report sync now posts
through the background script to POST /api/workspaces/:workspaceSlug/reports.
The copied extension is now self-contained for shared feedback types and no longer depends on
the old @feedme/shared workspace package.
Screenshot capture uses the activeTab model (no permission prompt). Chrome's
captureVisibleTab only accepts activeTab or all-hosts access, so the old per-domain
"Allow" flow could not authorize capture and produced intermittent "screenshot
permission is blocked" errors. Opening the popup grants activeTab; the popup's
"Start feedback on this page" action arms the content script, which then captures
for that page visit (resets on full reload). Activation is still gated to workspace
domains. The extension declares no broad host permission — only storage, tabs,
activeTab, plus host_permissions for the dashboard API and Cloudinary upload
origins.
Screenshot capture is mandatory. If Chrome blocks screenshot capture, the extension keeps
the report unsaved, shows a blocking message in the bottom status pill, and does not
create or sync the report. After submit starts, the composer closes and should not
reopen around screenshot capture. The large extension surfaces are hidden during
capture, but the bottom status pill may remain visible so the user does not see
a blank state while FeedMe is working.
The composer collects a user-authored title, description, category, and severity instead
of deriving the report title from the browser page title.
The content script is no longer registered in the manifest. It is injected on
demand from the popup via browser.scripting.executeScript using activeTab, so the
extension declares no broad host access (content_scripts is empty, host_permissions
covers only the dashboard API and Cloudinary origins) and FeedMe code is never
injected on unrelated pages.
```

Dashboard distribution note:

```txt
Until FeedMe has a Chrome Web Store listing, the dashboard serves the current
extension package from public/downloads/feedme-extension.zip. The sidebar
extension card and topbar Capture report CTA open one shared install dialog with
manual Chrome instructions: download, unzip, open chrome://extensions, enable
Developer mode, and Load unpacked. After extension changes, refresh the package
by creating the WXT Chrome ZIP and copying it into public/downloads with that
stable filename before deployment.

Production dashboard/API origin:
https://meefeed.vercel.app

The production extension ZIP must be built with WXT_API_BASE_URL pointing at
that origin, and its manifest must include the dashboard origin in
host_permissions so the extension service worker can call FeedMe APIs.
Production dashboard cookies use SameSite=None; Secure so the extension can
reuse the signed-in dashboard session from chrome-extension:// requests.
Unsafe API mutations are protected by `src/proxy.ts`: dashboard clients send
`x-feedme-client: dashboard`, extension clients send `x-feedme-client:
extension`, and cross-site browser writes without a trusted origin/client marker
are rejected.
```

Dashboard performance note:

```txt
The reports list/read model must stay summary-first. Do not load full screenshot
evidence for every report in list endpoints. Screenshots now live on Cloudinary
(Slice 9), so list rows/cards render the optimized thumbnail while the list page
publishes visible reports and selected IDs to the workspace dashboard data store,
and the right rail fetches only the selected report detail through
GET /api/workspaces/:workspaceSlug/reports/:reportId.

Row selection, report filters, My Work scope changes, Team role filters, and
search should update client state first and sync the URL with native history.
Avoid App Router navigation for these micro-interactions.
```

### Slice 8: Assignment And My Work

Status:

```txt
implemented
```

Goal:

```txt
Turn report ownership into a usable workflow.
Admins and owners can assign reports to active developers or designers and resolve reports.
Developers and designers can see assigned work in My Work and move their assigned reports through implementation statuses.
Reporters can see the feedback they submitted in My Work.
```

Routes:

```txt
PATCH /api/workspaces/:workspaceSlug/reports/:reportId/assignment
PATCH /api/workspaces/:workspaceSlug/reports/:reportId/status
```

Server files:

```txt
src/server/reports/service.ts
src/server/reports/validation.ts
src/app/api/workspaces/[workspaceSlug]/reports/[reportId]/assignment/route.ts
src/app/api/workspaces/[workspaceSlug]/reports/[reportId]/status/route.ts
src/lib/reports.ts
```

UI files:

```txt
src/app/[workspaceSlug]/my-work/page.tsx
src/components/feedme/dashboard/my-work-page.tsx
src/app/[workspaceSlug]/reports/[reportId]/page.tsx
src/components/feedme/dashboard/workspace-shell.tsx
src/components/feedme/dashboard/report-detail.tsx
src/lib/api-client.ts
```

Rules:

```txt
resolve workspaceSlug through the signed-in user's active membership
scope all mutations by workspaceId and reportId
assignment requires report:assign and only accepts active developer or designer members
assigning a developer or designer moves the report to assigned
assignment may be corrected while status is assigned
assignment is locked once work reaches in_progress, ready_for_review, resolved, or archived
resolved reports keep assigneeUserId as the completion owner for team metrics
completed reports do not count as currently assigned work
assignee status updates require the report to be assigned to that developer or designer
assigned developers and designers can only move assigned work to in_progress or ready_for_review
owner/admin can resolve reports directly
resolved status sets resolvedAt; non-resolved status updates clear resolvedAt
archived status sets archivedAt so archived reports leave the active read model
every assignment/status mutation writes a report_status_events row
```

Dashboard wiring:

```txt
My Work now reads real reports instead of mock report IDs.
Assigned to me filters by assigneeUserId matching the current user and active assignment statuses only.
Reported by me filters by reporterUserId matching the current user.
Developers and designers default to Assigned to me; other roles default to Reported by me.
The Reports/My Work right rail reads workspace members from the shared members query and shows an Assignment control on the selected report.
The right rail assignment control lists active developers and designers, saves through PATCH /assignment, and reconciles caches optimistically.
For assigned developers and designers, the same right rail shows Start work and Ready for review actions when the selected report is assigned to the signed-in member. These actions call PATCH /status and reconcile caches optimistically.
For admins/owners, the same right rail can resolve reports directly without opening the full detail page.
Report detail shows a workflow panel for admins/owners and assigned developers/designers.
```

### Slice 9: Screenshot Storage

Status:

```txt
implemented
```

Goal:

```txt
Move report screenshots out of Postgres. The extension uploads screenshots
directly to Cloudinary and only sends the resulting https URLs to the report API.
This removes multi-megabyte base64 data: URLs from report_assets and keeps report
writes under Vercel's serverless request body limit.
```

Provider and flow:

```txt
Cloudinary, signed direct upload.
-> extension asks the dashboard for a short-lived upload signature
-> extension background worker uploads each screenshot straight to Cloudinary
-> extension submits the report with only the returned https URLs
-> api secret stays server-side; cloud name and api key are public
```

Route:

```txt
POST /api/uploads/signature
```

Server files:

```txt
src/server/uploads/cloudinary.ts        env config + SHA-1 request signer
src/server/uploads/service.ts           createReportUploadSignature()
src/app/api/uploads/signature/route.ts  session-gated signature endpoint
src/lib/cloudinary.ts                    client-safe thumbnail transform helper
src/server/reports/validation.ts        asset url must be FeedMe Cloudinary image storage
src/server/reports/service.ts           read model adds thumbnailUrl per screenshot
src/lib/reports.ts                       WorkspaceReportScreenshot.thumbnailUrl
src/app/api/mcp/route.ts                only fetches validated Cloudinary image urls
```

Extension files:

```txt
extension/src/services/uploadApi.ts     getUploadSignature + uploadDataUrlToCloudinary
extension/src/services/reportsApi.ts    uploads assets before POST, sends https URLs only
extension/wxt.config.ts                 adds https://api.cloudinary.com/* host permission
```

Rules:

```txt
require a signed-in user for the upload signature
report asset urls must be https Cloudinary image URLs for this FeedMe cloud/folder
data:, blob:, non-Cloudinary URLs, wrong Cloudinary accounts, and wrong folders are rejected
the extension uploads each screenshot directly, then submits the URLs
one signature covers all screenshots in a single report
already-hosted assets are not re-uploaded on sync retries
if a Cloudinary upload fails, the report stays unsynced and retries later
the read model derives w_720,f_auto,q_auto thumbnails for grid/rail surfaces
fullscreen evidence viewers use the full-resolution original url
MCP embeds screenshots only after re-validating the Cloudinary URL, refusing redirects, non-image content, and oversized responses
```

Environment:

```txt
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
CLOUDINARY_UPLOAD_FOLDER optional, defaults to feedme/reports
```

Dashboard wiring:

```txt
Grid cards, the report right rail, and detail inline cards render the optimized
Cloudinary thumbnail. The fullscreen evidence viewers render the full-resolution
original. next/image uses unoptimized, so no images.remotePatterns config is
required yet.
```

Local dev note:

```txt
npm run db:reset -- --yes wipes all app tables (scripts/reset-db.mjs) to start
fresh. It only truncates data and keeps the schema, so no migration is needed.
```

Reports empty-state fix:

```txt
When a workspace has zero reports, the reports index renders the server-side
onboarding empty state instead of ReportsList, which never registered with the
dashboard data store. That left reportRailReady false and the right rail stuck on
its loading skeleton. EmptyReportsRailSync (in reports-list.tsx) now registers an
empty report set so the shell disables the rail and the empty state owns the
canvas, matching the DASHBOARD.md zero-reports rule.
```

### Slice 10: MCP Server (Coding Agent Access)

Status:

```txt
implemented
```

Goal:

```txt
Developers connect their FeedMe account to a coding agent (Claude Code, Cursor, etc.)
through a hosted MCP server, pull their assigned reports with full handoff context
and screenshots, fix them, and mark them ready for review from the editor.
```

Locked decisions:

```txt
transport: remote MCP server hosted in the Next.js app at /api/mcp (Streamable HTTP)
auth: Personal Access Token (feedme_pat_...), Bearer header, workspace-scoped
token store: personal_access_tokens table, only the hash stored (mirror sessions),
             role read live from membership at use time so demoted/removed members lose access
screenshots: get_report embeds the optimized Cloudinary thumbnails as image content
             blocks the agent can see (vision tokens, not base64 text)
```

Library:

```txt
mcp-handler@1.1.0 (wraps @modelcontextprotocol/sdk@1.26.0), zod v4 supported.
Stateless Streamable HTTP (no Redis), SSE disabled.
createMcpHandler(init, { serverInfo }, { basePath: "/api", disableSse: true })
withMcpAuth(handler, verifyToken, { required: true }) for PAT auth.
Tools read context from extra.authInfo.extra (the resolved AccessTokenContext).
```

Routes:

```txt
POST   /api/mcp                                        MCP Streamable HTTP endpoint (GET/POST/DELETE)
GET    /api/workspaces/:workspaceSlug/tokens          list the caller's tokens
POST   /api/workspaces/:workspaceSlug/tokens          create a token (plaintext returned once)
DELETE /api/workspaces/:workspaceSlug/tokens/:tokenId revoke a token
```

Server files:

```txt
src/db/schema.ts                                     personal_access_tokens table
src/server/access-tokens/service.ts                  generate / resolve / list / revoke (hashed)
src/server/access-tokens/validation.ts               label + token id schemas
src/app/api/workspaces/[workspaceSlug]/tokens/route.ts             create + list
src/app/api/workspaces/[workspaceSlug]/tokens/[tokenId]/route.ts   revoke
src/app/api/mcp/route.ts                              MCP handler + PAT auth + tools
src/components/feedme/dashboard/connect-agent-dialog.tsx           workspace-menu dialog
src/components/feedme/dashboard/workspace-shell.tsx                "Connect coding agent" menu item
```

Tools (v1, read + workflow):

```txt
whoami()                          confirm workspace + role (connection test)
list_my_reports(status?, limit?)  reports assigned to the caller (scope=assigned)
get_report(reportId)              full handoff text + page/element/annotated screenshots as images
start_work(reportId)              assigned -> in_progress (assigned developer/designer only)
mark_ready_for_review(id, note?)  -> ready_for_review (assigned developer/designer only)
```

Rules:

```txt
require a valid workspace-scoped PAT (Bearer); no token -> 401
resolve token -> user -> ACTIVE membership -> role on every request
every tool reuses the existing report services (listWorkspaceReports, getWorkspaceReport,
  updateWorkspaceReportStatus) so tenant scoping and role checks match the REST API
create-token requires an active member (the token only grants the caller's own role)
tokens are workspace-scoped: one token = one workspace, no workspace argument on tools
```

Verified:

```txt
Step 0 spike on Next 16: initialize, tools/list, tools/call all work over Streamable HTTP.
End to end with a real PAT: no-auth -> 401; whoami -> workspace/role; get_report -> handoff
text + 3 screenshots as image blocks; start_work on an unassigned report -> the service guard
("Assign a developer or designer before moving this report forward") surfaces as an MCP tool error.
```

Dashboard wiring:

```txt
The workspace switcher menu has a "Connect coding agent" item that opens a dialog
scoped to the current workspace. It explains the workspace scoping, shows the MCP
endpoint URL, generates a named token (revealed once) with copy, shows a ready
agent config snippet (url + Authorization: Bearer token), and lists/revokes the
caller's tokens. The dialog never keeps the plaintext token after it closes.
```

Later:

```txt
OAuth connect (one-click, no token copy), screenshots as MCP resources, admin
tools (assign / resolve), and a report counts contract for the agent.
```

### Slice 11: Production Dashboard Data Layer

Status:

```txt
implemented
```

Goal:

```txt
Make Reports, My Work, Team, Domains, and right-rail interactions feel instant
through a real frontend data architecture instead of page-local fetch state.
```

Locked decisions:

```txt
server state: TanStack Query
durable dashboard UI state: Zustand
shareable navigation/filter/selection state: URL search params
temporary component state: React local state
backend entities must never live in Zustand
report workflow mutations must not call router.refresh()
```

Approved dependencies:

```txt
@tanstack/react-query
zustand
```

Core query families:

```txt
workspace
workspace members
workspace domains
reports list
report detail
report counts
my work
invites
MCP tokens
```

Rules:

```txt
list/detail/counts are separate contracts
list pages render cached summaries immediately on return navigation
right rail renders summary first, then hydrates selected report detail
assignment/status mutations patch every affected cache optimistically
failed mutations roll back to the previous cached report
polling or realtime must surface new reports without hard reload
```

Implemented dashboard query hooks:

```txt
src/lib/report-queries.ts    reports list/detail/counts + assignment/status mutations
src/lib/team-queries.ts      workspace members
src/lib/domain-queries.ts    workspace domains + add/remove mutations
src/lib/invite-queries.ts    workspace invites + create mutation
src/lib/token-queries.ts     MCP tokens + create/revoke mutations
src/lib/query-keys.ts        shared key factory for workspace-backed resources
```

Dashboard wiring:

```txt
Reports, My Work, Team, Domains, Invite generation, MCP token management, and
the report right rail now use query hooks instead of component-owned fetch
islands.

Domain deletion and MCP token revocation are optimistic with rollback.
Domain, invite, and token creation update their shared caches after the server
returns the normalized/secure record.

The MCP token plaintext is never stored in TanStack Query. Only the token record
is cached; the plaintext remains local to the dialog and is cleared on close.

Reports and My Work now separate visible list ownership from freshness polling.
The visible list query does not use refetchInterval, so background polling cannot
reshape the table while a user is reading or clicking. A separate freshness query
checks the current first page for unseen report ids and shows a user-applied
"new reports available" notice. Applying the notice refetches the visible list
and counts.

Reports, My Work, and Team now share first-load failure handling:
centered retry state when no cached rows exist, compact inline retry when cached
data remains visible after a background error, and route-shaped table skeletons
for first load.
```

Backend hardening still useful:

```txt
GET /api/workspaces/:workspaceSlug/reports/counts
stable opaque cursors, eventually keyset-based
report updatedAt/version for cache reconciliation
mutation responses with updated report or mutation delta
indexes for workspace-scoped status, assignee, reporter, capturedAt, and search
```

Implemented counts contract:

```txt
GET /api/workspaces/:workspaceSlug/reports/counts?q=&scope=

returns:
all
open
inProgress
resolved
assignedToMe
reportedByMe
```

Reference:

```txt
See FRONTEND_DATA_ARCHITECTURE.md for the full production data architecture.
```

## API Contract For The First Flow

### Signup

```txt
POST /api/auth/signup
```

Input:

```txt
email
password
confirmPassword
```

Creates:

```txt
user
session
```

Returns:

```txt
session user
nextPath: /welcome
```

### Login

```txt
POST /api/auth/login
```

Input:

```txt
email
password
```

Creates:

```txt
session
lastLoginAt update
```

Returns:

```txt
session user
nextPath based on onboarding state
```

### Session

```txt
GET /api/auth/session
```

Returns:

```txt
current user
profile completion state
active memberships
default workspace when available
```

### Onboarding State

```txt
GET /api/onboarding/state
```

Returns:

```txt
profileComplete
hasWorkspace
nextStep
nextPath
```

### Onboarding Profile

```txt
POST /api/onboarding/profile
```

Input:

```txt
fullName
displayName optional
title optional
```

Upserts:

```txt
user profile
```

### Onboarding Workspace

```txt
POST /api/onboarding/workspace
```

Input:

```txt
workspaceName
firstDomain
```

Creates atomically:

```txt
workspace
owner membership
first active domain
profile onboardingCompletedAt
```

Returns:

```txt
workspace
nextPath: /:workspaceSlug/reports
```

## Report List And Detail Contracts

Reports use two separate read contracts.

List contract:

```txt
GET /api/workspaces/:workspaceSlug/reports
```

Query params:

```txt
q optional
status all | open | in_progress | resolved
scope assigned | reported optional
sort newest | oldest | priority | comments
cursor optional opaque token
limit default 30, max 50
```

Returns:

```txt
reports: lightweight report summaries
pageInfo: { hasNextPage, nextCursor, limit }
```

The list contract is backend-filtered and paginated. The dashboard must not fetch all workspace reports and then filter them in the browser for Reports or My Work. Search, status tabs, My Work scope, sort, and pagination belong to the API query.

Detail contract:

```txt
GET /api/workspaces/:workspaceSlug/reports/:reportId
```

Returns:

```txt
report: full detail with screenshots, selected element, feedback, developer prompt
```

The list contract should stay fast and avoid heavy screenshot payloads. The detail contract can fetch heavier evidence by report id when the rail or full detail page needs it. Image storage now lives on Cloudinary (Slice 9): report_assets stores hosted https URLs instead of base64/data URLs, and the read model derives optimized thumbnails for list/rail surfaces.

Dashboard interaction rules:

```txt
row selection updates locally immediately
right rail may show summary first, then hydrate detail
assignment/status mutations update optimistically
failed mutations roll back to the previous report
do not router.refresh() after assignment/status changes
```

Future follow-up:

```txt
add a report counts contract for exact tab totals across paginated result sets
```

## Dev-Friendly Style

Prefer clear, boring names over clever abstractions.

Use small files with obvious ownership:

```txt
auth service owns auth behavior
workspace service owns workspace behavior
domain helper owns domain normalization
policy module owns permission decisions
route handler owns HTTP transport
```

Use typed return values from service functions. Avoid returning raw database rows when the UI or extension needs a stable contract.

Keep comments sparse but helpful. Comment why a rule exists, not what the next line does.

## What Not To Do

Do not build:

```txt
a generic enterprise RBAC engine
database-backed custom roles yet
OAuth before MVP auth works
report APIs before auth/onboarding is real
extension API before workspace/domain APIs are real
```

Do not skip:

```txt
server-side validation
password hashing
session token hashing
workspace membership checks
domain normalization
transactional workspace creation
```
