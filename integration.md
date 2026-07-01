# FeedMe Integration Flow

This file is the integration source of truth for how FeedMe connects onboarding, workspaces, domains, dashboard roles, invites, reports, and the browser extension.

Read this with:

- `PROJECT_VISION.md` for product direction.
- `DASHBOARD.md` for dashboard routes and layout behavior.
- `design.md` for visual tokens and UI language.
- `API_IMPLEMENTATION_GUIDE.md` for modular backend/API coding rules.

## Core Principle

FeedMe is workspace-first.

Everything important belongs to a workspace:

```txt
User
-> Workspace membership
-> Workspace
-> Domains
-> Reports
-> Assignments
-> Status events
-> Comments
```

The dashboard and Next.js backend are the source of truth. The browser extension is a workspace-aware capture client. The copied v1 extension can donate useful UI and interaction pieces, such as the floating button, element selection, screenshot capture, and composer, but its old local profile/report model is not the product contract.

## Naming

Use `workspace` everywhere in product copy, routes, data models, and extension UI.

Avoid splitting the mental model between `organization` and `workspace` for MVP. A workspace can later become part of a larger enterprise organization model, but the current product should stay simple and consistent.

## Workspace Creation Flow

The first user becomes the workspace owner.

```txt
1. User lands on FeedMe.
2. User signs in with email.
3. User completes profile:
   - name
   - display name
   - optional avatar later
4. User creates a workspace:
   - workspace name
   - workspace slug
   - optional logo
5. User is asked to add the first domain.
6. User enters the workspace dashboard.
```

### Domain Step During Welcome

The welcome flow should require one domain because capture domains are core to the product.

The UI should keep the ask lightweight:

```txt
Add the first website where your team will capture feedback.
You can add up to 4 more later.
```

This creates a useful workspace immediately while making clear that domains remain manageable later.

## Domain Model

A workspace can have up to 5 domains in MVP.

Domains are exact capture surfaces. Do not automatically include subdomains.

Examples:

```txt
bump.fm
v2.bump.fm
test.bump.fm
```

These are three separate domains. Adding `bump.fm` does not imply `v2.bump.fm` or `test.bump.fm`.

For MVP, do not support localhost domains in production workspace settings.

### Domain Status

MVP domain status can be simple:

```txt
active
```

Future domain verification may add:

```txt
pending_verification
verified
disabled
```

Verification means proving the workspace controls the domain, such as DNS TXT, HTML file upload, meta tag, or provider integration. This matters later because otherwise someone could add a domain they do not own.

For MVP, hard verification is deferred. The server must still validate:

- the submitting user is signed in
- the user is a member of the workspace
- the submitted page domain is in the workspace domain allowlist

## Dashboard Routing

Workspace routes remain root-level:

```txt
/:workspaceSlug
/:workspaceSlug/reports
/:workspaceSlug/reports/:reportId
/:workspaceSlug/my-work
/:workspaceSlug/team
/:workspaceSlug/domains
/:workspaceSlug/settings
```

For the current dashboard implementation:

```txt
/:workspaceSlug
-> /:workspaceSlug/reports
```

Reports are the home surface. Captured extension feedback lands there first.

## Roles

Workspace roles for MVP:

```txt
owner
admin
developer
designer
reporter
viewer
```

All workspace members can submit reports through the extension.

Permissions:

```txt
owner
-> full workspace control
-> manage domains
-> manage members and roles
-> assign reports
-> resolve reports

admin
-> manage domains
-> manage members and roles
-> assign reports
-> resolve reports
-> override workflow state

developer
-> can be assigned reports
-> can move assigned work through implementation statuses
-> can mark assigned reports ready for review

designer
-> can submit reports
-> can review/comment on visual issues
-> may participate in QA/reopen flows later

reporter
-> can submit reports
-> can view report status

viewer
-> can view workspace reports where permitted
```

Developers are the primary assignable implementation role. Admins can assign work to developers and can resolve reports directly when needed.

## Report Lifecycle

Internal report statuses:

```txt
submitted
reviewing
assigned
in_progress
ready_for_review
resolved
archived
```

Recommended flow:

```txt
submitted
-> reviewing
-> assigned
-> in_progress
-> ready_for_review
-> resolved
-> archived
```

Admin override:

```txt
submitted/reviewing/assigned/in_progress/ready_for_review
-> resolved
```

Developer behavior:

- A developer can work on assigned reports.
- A developer can mark assigned reports as `ready_for_review`.
- A developer does not need to be the final resolver.

Reporter-facing labels can stay simpler:

```txt
Submitted
Reviewing
In progress
Resolved
```

## Invite Flow

For MVP, invites are link/code based, not email-bound.

Admin or owner creates an invite link with a default role:

```txt
/join/:inviteCode
```

The invite code stores:

```txt
workspaceId
role
createdByUserId
createdAt
expiresAt optional
maxUses optional
```

Invite acceptance flow:

```txt
1. Invited user opens invite link.
2. User signs in or creates an account.
3. FeedMe validates invite code.
4. User joins the workspace with the invite role.
5. User lands in that workspace dashboard.
```

For MVP, the invite can be shared manually through any channel. Email-bound invites can come later.

### Invite Domain Gate

If a workspace has zero domains and an admin tries to invite a teammate, block the invite flow and show:

```txt
Add at least one capture domain before inviting teammates.
```

This keeps teams from joining a workspace that cannot capture feedback yet.

## Extension Purpose

The extension is a capture client.

It should not own product truth. It should not keep a separate reporter profile system. It should not decide workspace permissions by itself.

The extension should:

- know the signed-in user
- fetch that user's workspaces
- let the user choose the active workspace
- know which domains belong to the active workspace
- request browser permissions for exact domains
- show the floating capture button only when the current tab is allowed
- capture selected element metadata
- capture screenshots
- submit reports to the Next.js backend
- retry queued submissions when offline

The backend must validate all important actions again.

## Extension Authentication

Extension auth should connect to the main FeedMe app.

Expected flow:

```txt
1. User opens extension popup.
2. If not signed in, popup shows Sign in.
3. Sign in opens FeedMe web auth.
4. After auth, the extension receives an extension-safe session/token.
5. Extension calls the Next.js backend for bootstrap data.
```

Bootstrap data:

```txt
current user
workspace memberships
active/default workspace
domains for each workspace
role in each workspace
```

The exact auth mechanism can be decided during implementation, but the extension must not rely on the old local v1 reporter profile.

## Extension Workspace Selection

The popup should include a workspace dropdown.

```txt
Active workspace: Bump

Available workspaces:
- Bump
- Client QA Lab
- Personal Test Workspace
```

The selected workspace controls where reports are submitted.

If the same domain exists in multiple workspaces, the extension uses only the active popup workspace.

Example:

```txt
User belongs to Workspace A and Workspace B.
Both allow bump.fm.
Popup active workspace is Workspace B.
Report from bump.fm goes to Workspace B.
```

## Extension Domain Permissions

Use optional exact host permissions per domain.

Do not request broad all-sites permission for MVP.

Reason:

- FeedMe inspects pages and captures screenshots.
- Asking for all-sites access creates a heavier trust burden.
- A workspace can have at most 5 domains, so exact per-domain permission UX is manageable.

Permission model:

```txt
Workspace domain: v2.bump.fm
Chrome host permission: https://v2.bump.fm/*
```

Each domain is enabled separately.

Popup domain state example:

```txt
Bump

Domains
- bump.fm       Enabled
- v2.bump.fm    Enable
- test.bump.fm  Enable
```

When a user clicks `Enable`, the extension asks Chrome for permission to that exact domain.

The floating button appears only when all are true:

```txt
user is signed in
active workspace exists
current tab domain is in active workspace allowlist
extension has host permission for current tab origin
backend domain check passes or cached allow state is valid
```

## Extension Capture Flow

```txt
1. User visits an allowed domain.
2. Extension sees active workspace and allowed domain.
3. Floating FeedMe button appears.
4. User activates feedback mode.
5. User selects an element.
6. User writes feedback.
7. Extension captures:
   - page URL
   - exact domain
   - selected element metadata
   - viewport metadata
   - browser/device metadata
   - visible screenshot
   - cropped/annotated element screenshot when possible
8. Extension submits report to workspace API.
9. Server validates membership and domain.
10. Report appears in workspace dashboard.
```

## Report Data Shape

Reports should support dashboard triage and developer handoff.

Core fields:

```txt
id
workspaceId
title
summary
severity: low | medium | high | urgent
status: submitted | reviewing | assigned | in_progress | ready_for_review | resolved | archived
type: bug | ux | copy | performance | accessibility
domain
url
browser
device
viewport
capturedAt
screenshots:
  - page screenshot
  - element/annotated screenshot
selectedElement:
  - tag
  - selector
  - text
  - attributes
feedback:
  - message
  - reporter user id
  - reporter name
  - reporter email
developerPrompt
assignee
commentsCount
```

The extension may submit a raw capture payload. The backend can derive title, summary, status, developer prompt, screenshot records, and dashboard-ready fields.

## API Direction

The Next.js backend owns the API.

Expected API groups:

```txt
Auth/session
-> current user
-> extension-safe session/token

Workspaces
-> list my workspaces
-> create workspace
-> update workspace

Domains
-> list domains
-> add domain
-> remove domain
-> domain cap enforcement

Invites
-> create invite link
-> accept invite

Extension
-> bootstrap current user/workspaces/domains
-> check current tab domain for active workspace
-> submit captured report

Reports
-> list workspace reports
-> get report detail
-> assign report
-> update status
-> add comment
```

The old v1 endpoint shape, such as plain `POST /api/reports` without workspace context, should be replaced.

Every report write must include or resolve workspace context.

## Dashboard Report Behavior

Reports index:

- Default view is table/list.
- Grid view is optional via `?view=grid`.
- Selecting a row/card updates the right rail.
- Right rail shows selected report evidence and metadata.
- Opening a report navigates to `/:workspaceSlug/reports/:reportId`.

Report detail:

- Main canvas owns screenshot evidence, feedback, selected element data, metadata, and developer prompt.
- No internal right rail on report detail route.

## Dashboard Domain Behavior

Domains can be managed after onboarding.

Rules:

- max 5 domains per workspace
- exact domains only
- no automatic subdomain inclusion
- no localhost for MVP
- deleting a domain should stop future captures on that domain
- existing reports from deleted domains should remain historical records

## MVP Boundaries

In MVP:

- Use workspace everywhere.
- Allow up to 5 exact domains per workspace.
- Require a first domain during welcome.
- Keep the invite-domain gate as a defensive fallback for any legacy or partial workspace state.
- Do not support localhost domains.
- Do not auto-include subdomains.
- Do not require hard domain verification yet.
- Use optional exact Chrome host permissions, not all-sites permission.
- Let every workspace member submit reports.
- Assign implementation work to developers.
- Let developers mark work ready for review.
- Let admins resolve reports and override status.
- Use invite links/codes, not email-bound invites.
- Treat the copied v1 extension as reusable UI/interaction material only.

## Future Work

Later versions can add:

- hard domain verification
- email-bound invites
- invite expiry and usage limits
- SSO/SAML
- audit logs
- Slack/Jira/GitHub/Linear integrations
- AI report summarization
- AI developer prompt generation
- screenshot/object storage
- billing by workspace, seats, reports, domains, or projects
- enterprise organization layer above workspaces
