# Auth And Workspace Flow

This file defines the MVP flow for authentication, signup, welcome onboarding, first workspace creation, first domain capture setup, and the creator's workspace role.

Read this with:

- `PROJECT_VISION.md` for product intent.
- `integration.md` for extension and dashboard integration.
- `DASHBOARD.md` for workspace route behavior.
- `design.md` for visual language.

## Goal

A new user should be able to:

```txt
sign up
-> complete profile
-> create first workspace
-> add first capture domain
-> become the workspace owner
-> land in /:workspaceSlug/reports
```

An existing user should be able to:

```txt
log in
-> resume incomplete onboarding if needed
-> otherwise enter their workspace dashboard
```

The backend and database are the source of truth. The UI should never fake workspace membership or role state.

## Routes

MVP auth routes:

```txt
/login
/signup
/welcome
```

Dashboard entry after onboarding:

```txt
/:workspaceSlug/reports
```

Reserved workspace slugs must include:

```txt
login
signup
welcome
workspaces
api
admin
settings
reports
team
domains
help
extension
```

## Login

Route:

```txt
/login
```

Fields:

```txt
email
password
```

Primary action:

```txt
Log in
```

Submit behavior:

```txt
after click, keep the button disabled while authenticating and while route navigation is pending
do not return the button to an idle clickable state unless the request fails
```

Secondary action:

```txt
New to FeedMe? Create account
```

The secondary action goes to:

```txt
/signup
```

### Google Login

Keep the Google button visible for trust, but disabled in MVP.

Behavior:

```txt
Continue with Google
-> disabled
-> tooltip or hover copy: Google login is coming soon
```

Do not wire Google auth until it is actually supported.

## Signup

Route:

```txt
/signup
```

Fields:

```txt
email
password
confirm password
```

Password guidance:

```txt
show inline requirements before submit
use at least 8 characters
include at least one letter
include at least one number
avoid common passwords
confirm password must match before the account is created
```

Primary action:

```txt
Create account
```

Submit behavior:

```txt
after click, keep the button disabled while creating the account and while route navigation is pending
do not return the button to an idle clickable state unless the request fails
```

Secondary action:

```txt
Already have an account? Log in
```

After successful account creation:

```txt
/check-email
-> verification link
-> /verify-email
-> /welcome (or the validated invite/deep-link destination)
```

Signup does not create a session. A single-use verification link creates the
first authenticated session only after the address is verified. Profile and
workspace data are collected in the welcome flow.

## Welcome

Route:

```txt
/welcome
```

Welcome has two steps:

```txt
1. Profile
2. Workspace
```

The route can manage the step internally or expose it in query string later. The backend should be able to resume the right step from persisted onboarding state.

## Welcome Step 1: Profile

Fields:

```txt
full name: required
display name: optional
title: optional
```

Display name default:

```txt
if display name is blank:
  use the first word from full name
```

Examples:

```txt
Full name: Jordan Lee
Display name default: Jordan

Full name: Maya Chen
Display name default: Maya
```

Profile fields:

```txt
fullName
displayName
title
avatarUrl optional, future
```

Do not over-explain display name in UI. A short helper is enough:

```txt
This could be your first name or a nickname.
```

## Welcome Step 2: Workspace

Fields:

```txt
workspace name: required
first domain: required
workspace logo: optional in schema, hidden in MVP UI
```

Workspace logo:

- Keep `logoUrl` in the schema.
- Hide the upload control for MVP unless upload storage is ready.
- Do not show a disabled upload control in onboarding.

Domain helper text:

```txt
Add the first website where your team will capture feedback. You can add and manage domains later.
```

After submit, the backend should create:

```txt
workspace
workspace membership for creator
first workspace domain
```

Then redirect to:

```txt
/:workspaceSlug/reports
```

## Creator Role

The first user who creates a workspace receives:

```txt
role: owner
status: active
```

Owner is an admin-level role with future room for billing, workspace deletion, ownership transfer, and workspace-level authority.

If the UI needs simpler language during MVP, it can describe the creator as the workspace admin. The stored role should still be `owner`.

## Redirect Rules

Use these rules after login, signup, page refresh, and protected route access:

```txt
not signed in
-> /login

signed in but profile incomplete
-> /welcome

signed in with profile but no workspace membership
-> /welcome

signed in with incomplete workspace creation
-> /welcome

signed in with at least one workspace membership
-> most recent active workspace /:workspaceSlug/reports
```

If a user belongs to multiple workspaces, choose:

```txt
last active workspace
-> otherwise first active membership by createdAt
```

The extension later uses its own active workspace selection, but the web app should still remember the last active dashboard workspace.

## Additional Workspace Creation

`/welcome` is first-run onboarding only. Once a user has a complete profile and at least one active workspace membership, `/welcome` redirects to the default dashboard workspace.

Additional workspace creation belongs to:

```txt
/workspaces/new
```

The additional workspace form collects:

```txt
workspace name: required
first domain: required
```

It creates:

```txt
workspace
owner membership for the creator
first active workspace domain
```

Then it redirects to:

```txt
/:newWorkspaceSlug/reports
```

This flow does not change onboarding state. It requires onboarding to already be complete.

## Backend Transaction

Workspace creation should be atomic.

On final welcome submit:

```txt
1. Validate signed-in user.
2. Upsert profile fields.
3. Validate workspace name.
4. Generate and reserve workspace slug.
5. Validate first domain.
6. Create workspace.
7. Create owner membership.
8. Create first workspace domain.
9. Mark onboarding complete.
10. Redirect to /:workspaceSlug/reports.
```

If any step fails, do not leave partial workspace state unless the system can safely resume it.

## Data Model

This is the MVP data shape for the auth and workspace flow. Names can adapt to the chosen database tool, but the relationships should stay stable.

### User

Auth-owned account record.

```txt
id
email
passwordHash
emailVerifiedAt optional
createdAt
updatedAt
lastLoginAt optional
```

### User Profile

Product profile for display and collaboration.

```txt
id
userId
fullName
displayName
title optional
avatarUrl optional
onboardingCompletedAt optional
createdAt
updatedAt
```

`displayName` is required in storage, even if optional in UI. If the user leaves it blank, derive it from `fullName`.

### Workspace

```txt
id
name
slug
logoUrl optional
createdByUserId
createdAt
updatedAt
archivedAt optional
```

Slug rules:

- derived from workspace name by default
- lowercase
- URL-safe
- unique
- cannot use reserved slugs
- can append a short suffix if needed

### Workspace Membership

```txt
id
workspaceId
userId
role
status
invitedByUserId optional
joinedAt
createdAt
updatedAt
```

Role:

```txt
owner
admin
developer
designer
reporter
viewer
```

Status:

```txt
active
pending
disabled
removed
```

The creator gets:

```txt
role: owner
status: active
```

### Workspace Domain

```txt
id
workspaceId
host
status
addedByUserId
verifiedAt optional, future
createdAt
updatedAt
```

Status for MVP:

```txt
active
```

Future statuses:

```txt
pending_verification
verified
disabled
```

Domain rules:

- required during first workspace creation
- max 5 domains per workspace
- exact domains only
- no automatic subdomain inclusion
- no localhost for MVP
- strip protocol, path, query, hash, and trailing slash
- lowercase before storing

Examples:

```txt
https://app.example.com/dashboard -> app.example.com
example.com -> example.com
staging.example.com/anything -> staging.example.com
```

Invalid MVP examples:

```txt
localhost
127.0.0.1
http://localhost:3000
*.example.com
```

## Practical Role/Action Model

RBAC is core product architecture. Keep it concrete and trustworthy without building an enterprise permission engine before the product needs one.

Use a central server-side policy module:

```txt
can(user, action, workspace)
```

The first implementation can be code-defined and strongly typed. Later, the same action names can move into database-backed custom roles or enterprise policies without rewriting every feature.

Do not scatter permission checks across components.

Actions:

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

Baseline role permissions:

```txt
owner
-> all workspace and report actions

admin
-> all workspace and report actions except future owner-only billing/deletion/transfer

developer
-> workspace:read
-> report:create
-> report:read
-> report:comment
-> report:update_status on assigned reports
-> report:mark_ready_for_review on assigned reports

designer
-> workspace:read
-> report:create
-> report:read
-> report:comment

reporter
-> workspace:read
-> report:create
-> report:read
-> report:comment on permitted reports

viewer
-> workspace:read
-> report:read
```

This keeps the model simple now and leaves room for a database-backed permission table later.

## API Direction

Exact API shape can change during implementation, but this flow needs these capabilities:

```txt
POST /api/auth/signup
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/session
POST /api/auth/resend-verification
POST /api/auth/verify-email
POST /api/auth/forgot-password
POST /api/auth/reset-password
POST /api/auth/change-password
GET  /api/auth/sessions
DELETE /api/auth/sessions
DELETE /api/auth/sessions/:sessionId

POST /api/onboarding/profile
POST /api/onboarding/workspace
GET  /api/onboarding/state
```

`POST /api/onboarding/workspace` should handle the atomic creation of workspace, owner membership, and first domain.

If server actions are used instead of route handlers, they should preserve the same conceptual boundaries.

Authentication email is queued durably. Signup must validate email configuration
before account writes, then atomically commit the user, verification token, and
auth-email outbox event. Delivery failures retry in the background and must not
turn a successful database write into a failed-looking signup. Repeated signup
for an unverified email sends another verification link without changing the
stored password.

## Validation

Signup:

- email required
- email normalized to lowercase
- password required
- confirm password must match
- password must satisfy the shared FeedMe password policy: 8+ characters, at least one letter, at least one number, and not a common password

Profile:

- full name required
- display name optional, derived when blank
- title optional

Workspace:

- workspace name required
- slug generated and unique
- reserved slugs blocked
- first domain required
- first domain normalized
- first domain must not be localhost
- first domain must not be wildcard

## UI Copy

Login Google tooltip:

```txt
Google login is coming soon.
```

Signup link:

```txt
New to FeedMe? Create account
```

Login link:

```txt
Already have an account? Log in
```

Domain helper:

```txt
Add the first website where your team will capture feedback. You can add and manage domains later.
```

Workspace submit:

```txt
Create workspace
```

## Current UI Changes Needed

The current login page sends signup users to `/welcome`. This should change:

```txt
Sign up link
-> /signup
```

The current login primary action visually says `Continue`. It should become:

```txt
Log in
```

The current welcome workspace step shows company logo upload. For MVP:

```txt
hide logo upload
add required first domain field
```

The current Google button should remain visible but become disabled with coming-soon hover/help behavior.

## MVP Completion Criteria

This flow is complete when:

```txt
1. New user can create an account with email/password.
2. New user is routed to welcome.
3. User enters full name, optional display name, optional title.
4. User creates a workspace with required workspace name and required first domain.
5. System creates owner membership.
6. System stores first domain on the workspace.
7. User lands in /:workspaceSlug/reports.
8. Refreshing the app keeps the user in the correct authenticated/onboarded state.
9. Existing user can log in and land in their active workspace.
10. Google auth is visible but disabled as coming soon.
```
