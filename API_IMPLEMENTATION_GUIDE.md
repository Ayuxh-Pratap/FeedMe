# FeedMe API Implementation Guide

This file defines how we should build the FeedMe backend so the code stays modular, readable, and production-friendly as the product grows.

Read this with:

- `AUTH_WORKSPACE_FLOW.md` for signup, login, onboarding, and first workspace creation.
- `integration.md` for workspace, dashboard, extension, domain, invite, and report behavior.
- `PROJECT_VISION.md` for the product shape we are protecting.

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
cookie sameSite: lax
cookie secure: true in production
session token stored raw only in browser cookie
session token hash stored in database
session expiry: 30 days for MVP
```

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
return UI-ready name, displayName, initials, joinedAtLabel, assignedCount, and reportsCount
```

Dashboard wiring:

```txt
The Team page now reads real workspace memberships.
The Team right rail fetches the same member list from the API.
The workspace shell member count uses the real membership count.
Assigned and submitted report counts are already wired to the reports table and will populate once the report slice lands.
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
```

Dashboard wiring:

```txt
The Reports page now renders DB reports or the empty state.
The report detail page now reads a DB report by workspace and report id.
The report right rail fetches the real report list while on /:workspaceSlug/reports.
The My Work route still uses mock reports until the assignment/report ownership slice.
The workspace shell report count uses the real non-archived report count.
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
