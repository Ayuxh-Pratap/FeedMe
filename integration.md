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

Workspace creation has two entry points:

```txt
/welcome
-> first-run onboarding only
-> creates the user's first workspace

/workspaces/new
-> dashboard flow for already-onboarded users
-> creates an additional workspace
```

The creator of any workspace becomes that workspace owner.

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

After onboarding is complete, `/welcome` must not be reused for additional workspaces. Completed users who open `/welcome` should be redirected back to their default workspace. The workspace switcher should send "Create new workspace" to `/workspaces/new`.

### Additional Workspace Flow

Already-onboarded users can create another workspace from the dashboard workspace switcher.

```txt
1. User opens the workspace switcher.
2. User selects Create new workspace.
3. User lands on /workspaces/new.
4. User enters:
   - workspace name
   - first capture domain
5. Backend creates:
   - workspace
   - owner membership for the creator
   - first active workspace domain
6. User lands on /:newWorkspaceSlug/reports.
7. Workspace switcher lists all active workspace memberships.
```

This flow must not modify the user's onboarding state, except that it requires onboarding to already be complete.

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
-> can be assigned reports
-> can move assigned design/visual work through implementation statuses
-> can mark assigned reports ready for review

reporter
-> can submit reports
-> can view report status

viewer
-> can view workspace reports where permitted
```

Developers and designers are assignable implementation roles. Admins can assign work to active developers/designers and can resolve reports directly when needed.

## Report Lifecycle

### Project Tasks

FeedMe also accepts structured project tasks through MCP. These are first-class
workspace work items in the same report queue and assignment lifecycle, with
`source = task`.

Project tasks include a title, full description, severity, type, optional
source URL, optional assignee, developer prompt, and optional implementation
brief. They do not have screenshots, captured viewport data, or a selected DOM
element, and they do not require or inherit a workspace capture domain. The
dashboard presents a Details view instead of capture Evidence.

`bulk_create_tasks` accepts 1-25 tasks with stable `clientTaskId` values. A task
with an assignee starts as `assigned`; an unassigned task starts as `submitted`.
Retries with the same id reuse the existing task, while reusing an id for
different content is rejected. The PAT determines the destination workspace.
Before assigning imported work, the agent calls `list_assignable_members` and
uses an exact returned developer/designer user id or email. Every
implementation-brief field is optional; unknown fields are omitted rather than
invented. Existing unassigned reports or tasks can be routed later with
`assign_report`, which uses the same assignment locks and notifications as the
dashboard.

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

- A developer or designer can work on assigned reports.
- A developer or designer can mark assigned reports as `ready_for_review`.
- An assigned implementation member does not need to be the final resolver.
- Assignee status changes are only allowed on reports assigned to that developer/designer.
- Admins/owners assign reports to active developers/designers and can resolve directly.
- My Work uses `assigneeUserId` for Assigned to me and `reporterUserId` for Reported by me.

Assignment ownership rules:

- `assigned` means routed but not started; admins/owners may still correct the assignee here.
- `in_progress` and `ready_for_review` mean work ownership has started; reassignment is locked by default.
- `resolved` means completed; assignment is frozen and the assignee remains the completion owner for team metrics.
- Completed reports should not count as currently assigned work.
- If reassignment after work starts is needed later, add an explicit admin override action with a reason/status event instead of silently changing the assignee.

Team member metrics:

- `assignedCount` means active work currently assigned to the member (`assigned`, `in_progress`, `ready_for_review`).
- `completedCount` means resolved reports completed by that member.
- `reportsCount` means feedback submitted by that member.

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

## Extension Screenshot Permission

FeedMe captures screenshots with Chrome's `tabs.captureVisibleTab`. That API only
accepts two authorizations:

```txt
activeTab   granted with no prompt when the user invokes the extension; lasts
            until the tab is navigated or closed
<all_urls>  persistent, but forces the "read and change all your data on all
            websites" prompt, which misrepresents what FeedMe actually does
```

A per-domain host permission is NOT accepted by `captureVisibleTab`, which is why
the earlier per-domain "Allow" flow produced intermittent "screenshot permission
is blocked" errors: capture only succeeded while the transient activeTab grant
from opening the popup happened to still be live.

FeedMe uses the `activeTab` model (the same approach as full-page screenshot
tools) so there is never a permission prompt:

```txt
1. User opens the FeedMe popup on a workspace domain.
   -> opening the popup grants activeTab for that tab.
2. Popup shows "Start feedback on this page" and messages the content script
   to arm capture.
3. On-page tools appear; captureVisibleTab works for this page visit.
4. activeTab and the armed state reset on a full page reload, so the user opens
   FeedMe again to re-arm. In-app (SPA) navigation keeps it armed.
```

Permission footprint (no broad access declared anywhere, no runtime prompt):

```txt
permissions: storage, tabs, activeTab, scripting
host_permissions: dashboard API origin + Cloudinary upload origin only
content_scripts: none (injected on demand)
web_accessible_resources: none (content CSS is inlined)
```

The content script is not registered in the manifest. When the user starts
feedback, the popup injects it with `browser.scripting.executeScript` using the
activeTab grant, so Chrome's extension details page never shows broad
"read and change your data on all websites" access. A window guard prevents
double injection when re-arming on the same page.

Activation is still gated to workspace domains: the injected content script only
shows its tools when the current host is in the active workspace allowlist, and
FeedMe only captures when the user submits a report.

The floating tools appear only when all are true:

```txt
user is signed in
active workspace exists
current tab host is in the active workspace allowlist
FeedMe was armed for this page (popup opened -> Start feedback)
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
   - issue title
   - issue description
   - category
   - severity
   - visible page screenshot
   - cropped element screenshot when possible
   - annotated screenshot when possible
8. Extension submits report to workspace API.
9. Server validates membership and domain.
10. Report appears in workspace dashboard.
```

Screenshots are mandatory for FeedMe reports. If screenshot capture is blocked
by Chrome, the extension must not save the report locally or submit it to the
backend. After submit, close the composer and use the bottom status pill for
capture progress, save progress, success, and blocking errors. Do not reopen the
composer after capture starts:

```txt
Screenshot permission is blocked. FeedMe needs a screenshot to save this report.
```

Before calling Chrome screenshot capture, the extension should close the composer
and hide the large FeedMe interaction surfaces for a short capture frame: toolbar,
hover outline, selected-element label, and any composer panel. The bottom status
pill may remain visible during capture so the user never sees a blank flash; this
small artifact is acceptable until a later screenshot pipeline can capture page
pixels without extension UI.

The composer should ask for:

```txt
title: short issue title
description: issue details
category: bug | ux | design | copy | performance | accessibility
severity: low | medium | high | urgent
```

Voice dictation can be offered as an input helper for title and description.
Typing must remain the fallback when the browser does not support speech
recognition or the user denies microphone access.

## Extension MVP Distribution

FeedMe cannot silently install an unpublished Chrome extension from the
dashboard. Until a Chrome Web Store developer account and listing exist, the
dashboard should offer a downloadable extension ZIP and clear manual loading
steps.

Dashboard install surfaces:

```txt
sidebar extension card
topbar Capture report CTA when extension install/help is needed
```

Both surfaces should open the same install dialog:

```txt
1. Download extension ZIP.
2. Unzip the package.
3. Open chrome://extensions.
4. Enable Developer mode.
5. Click Load unpacked and choose the unzipped chrome-mv3 folder.
```

Operational packaging rule:

```txt
production dashboard/API origin:
https://meefeed.vercel.app

extension/.env.production:
WXT_API_BASE_URL=https://meefeed.vercel.app

extension/.output/feedmeextension-*-chrome.zip
-> copy/rename to main/public/downloads/feedme-extension.zip
-> deploy dashboard so users download the current package
```

The production extension manifest must include the dashboard origin in
`host_permissions` for API requests. Production dashboard sessions must be
issued with `SameSite=None; Secure` so the extension can call the API with the
same signed-in browser session.

Because production cookies are available to the extension, every unsafe FeedMe
API mutation is protected by a trust guard. Dashboard calls send
`x-feedme-client: dashboard`; extension calls send `x-feedme-client: extension`.
The server rejects cross-site browser mutations without the expected trusted
client marker/origin, and JSON routes require `Content-Type: application/json`.

Do not imply one-click installation until the extension is published through an
official browser store or an enterprise policy-controlled distribution channel.

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
  - title
  - description
  - message
  - reporter user id
  - reporter name
  - reporter email
developerPrompt
assignee
commentsCount
```

The extension may submit a raw capture payload. The backend can derive title, summary, status, developer prompt, screenshot records, and dashboard-ready fields.

### Screenshot Storage

Screenshots are hosted on Cloudinary, not stored as base64 in the database.

```txt
1. Extension captures the page, element, and annotated screenshots.
2. Extension requests a signed upload from POST /api/uploads/signature.
3. Extension uploads each screenshot directly to Cloudinary.
4. Extension submits the report with only the resulting https URLs.
5. report_assets stores the hosted URL, not the image bytes.
```

Rules:

```txt
report asset urls must be https Cloudinary image URLs for the configured FeedMe cloud/folder
data:, blob:, non-Cloudinary URLs, wrong Cloudinary accounts, and wrong folders are rejected
direct upload keeps large images out of the report API and Postgres
the read model derives optimized thumbnails for grid/rail; viewers use full res
MCP only fetches validated Cloudinary image URLs and rejects redirects/non-image/oversized responses
```

See `API_IMPLEMENTATION_GUIDE.md` Slice 9 for the storage implementation.

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
   GET /api/extension/bootstrap
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

Performance rules:

- list pages fetch report summaries, not full screenshot evidence for every row
- TanStack Query owns report, member, domain, invite, token, count, and detail caches
- Zustand owns durable dashboard UI preferences only, not backend entities
- the workspace shell does not refetch the reports list for the right rail
- Reports and My Work read visible report IDs and selected report context from the report list cache plus URL state
- the right rail renders selected summary context immediately
- full screenshot/detail evidence is fetched only for the selected report and cached
- row selection and filters update client state first, then sync the URL with native history
- assignment/status mutations update affected caches optimistically and never call `router.refresh()`
- new reports should appear through polling or realtime awareness, not hard reload

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

## Coding Agent Access (MCP)

Assigned implementation members can connect a FeedMe workspace to their coding
agent (Claude Code, Cursor, etc.) through a hosted MCP server, so the agent works the assigned queue
from inside the editor. This is why FeedMe fits: a report already carries the
screenshot, exact selector, element text, page/browser context, and developer
prompt — the precise handoff a coding agent needs.

Flow:

```txt
1. The member opens the "Connect coding agent" dialog in the dashboard and
   generates a workspace-scoped personal access token (feedme_pat_...).
2. They paste the MCP URL (/api/mcp) + token into their agent config.
3. MCP initialization tells the agent to read feedme://developer-guide or call
   get_feedme_guide. The guide explains tools, queues, statuses, and safe actions.
4. In the editor: "show new assigned work" -> list_new_assigned_reports.
5. "fix my next FeedMe issue" -> get_next_report chooses the highest-priority
   fresh assignment and returns the context pack + screenshots without starting it.
6. The agent explicitly calls start_work before implementation; the service atomically
   enforces assigned -> in_progress -> ready_for_review and rejects stale transitions.
7. get_report_context_pack returns the implementation brief, evidence, notes,
   blockers, status history, definition of done, and safe next actions.
8. Ambiguity uses ask_for_clarification; inability to proceed uses mark_blocked.
9. "mark it ready for review" -> mark_ready_for_review flips the status; the
   reporter/admin sees it in the dashboard.
```

Auth and trust:

```txt
remote MCP server at /api/mcp, Streamable HTTP
Bearer personal access token, workspace-scoped, only the hash stored
the token inherits the member's live role; developers/designers can only act on reports
  assigned to them, enforced by the same report services as the REST API
no token -> 401; every tool re-resolves user -> active membership -> role
report text, screenshots, DOM metadata, implementation briefs, notes, names, and links
  are delimited untrusted evidence, never instructions that can override agent rules
reference links never receive credentials/secrets and are opened only when relevant
```

Developer tools include `list_new_assigned_reports`, `list_in_progress_reports`,
`get_next_report`, `get_report_context_pack`, `start_work`, work/blocker notes,
clarification requests, and `mark_ready_for_review`. `list_my_reports` remains a
compatibility browser, not the agent's default work-selection path. See
`API_IMPLEMENTATION_GUIDE.md` Slice 10.

Agent guidance is published once from `src/server/mcp/developer-guide.ts` and
exposed as MCP initialization instructions, the `feedme://developer-guide`
resource, and the `get_feedme_guide` compatibility tool. Universal workflow
guidance stays separate from report-specific context packs.

## MVP Boundaries

In MVP:

- Use workspace everywhere.
- Allow up to 5 exact domains per workspace.
- Require a first domain during welcome.
- Keep the invite-domain gate as a defensive fallback for any legacy or partial workspace state.
- Do not support localhost domains.
- Do not auto-include subdomains.
- Do not require hard domain verification yet.
- Use the activeTab model for screenshot capture (no host-permission prompt); the user arms capture by opening the popup, and activation is still gated to workspace domains.
- Let every workspace member submit reports.
- Assign implementation work to developers and designers.
- Let assigned developers/designers mark work ready for review.
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
- billing by workspace, seats, reports, domains, or projects
- enterprise organization layer above workspaces
