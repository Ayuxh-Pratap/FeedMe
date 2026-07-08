# Dashboard Foundation

This file captures the dashboard direction for FeedMe. It should be read with `design.md` as the visual source of truth, `PROJECT_VISION.md` as the product source of truth, and `FRONTEND_DATA_ARCHITECTURE.md` as the production data-layer source of truth.

## Routing

FeedMe uses root workspace URLs:

```txt
/[workspaceSlug]
/[workspaceSlug]/reports
/[workspaceSlug]/reports/[reportId]
/[workspaceSlug]/inbox
/[workspaceSlug]/my-work
/[workspaceSlug]/team
/[workspaceSlug]/domains
/[workspaceSlug]/settings
```

For now, only the reports route is implemented.

```txt
/[workspaceSlug]
-> /[workspaceSlug]/reports
```

Root workspace slugs feel more personal and premium than `/workspace/[workspaceSlug]`. The tradeoff is reserved slug protection. Workspace creation must block slugs such as:

```txt
login
welcome
api
admin
settings
reports
team
domains
help
extension
```

## Layout Model

The dashboard is not a flat full-screen panel. It has two layers:

```txt
Outer workspace background
-> darker surface
-> owns the sidebar, workspace switcher, navigation, and extension card

Inner dashboard shell
-> lighter surface
-> inset from the top, right, and bottom
-> rounded corners
-> owns topbar, main page content, and optional right rail
```

The shell should feel like a premium product surface sitting inside a darker workspace environment.

Desktop chrome should stay compact so the reports canvas gets priority:

```txt
sidebar width: 232px
topbar height: 56px
right rail width: 288px
```

## Responsive Shell

The dashboard shell uses only two structural modes:

```txt
>= 1024px
-> desktop shell
-> persistent left sidebar
-> full search topbar
-> inset rounded dashboard panel
-> optional right rail controlled from the topbar

< 1024px
-> mobile/tablet shell
-> compact topbar
-> hamburger navigation sheet
-> search icon opens a search sheet
-> capture report remains visible as the primary action
-> right rail becomes a details sheet
```

Page content can continue to adapt internally, but navigation structure should not introduce extra shell modes between mobile/tablet and desktop.

## Default View Principle

Dashboard pages should default to table/list views wherever the surface is operational, queue-like, or meant for repeated scanning. This includes reports, My Work, Team, and future settings/admin tables.

```txt
default
-> table/list view
-> compact rows
-> fast scanning, sorting, filtering, and selection

optional
-> card/grid view
-> visual browsing when screenshots or previews help recognition
```

For report surfaces, no `view` query means table mode. Card mode is opt-in with:

```txt
?view=grid
```

This keeps FeedMe practical as the dataset grows while still letting users switch to the visual evidence gallery when they want to browse by screenshot.

## Dashboard Regions

```txt
Workspace sidebar
-> workspace switcher
-> Inbox
-> Reports
-> My Work
-> Team
-> extension education card

Workspace switcher menu
-> Settings (disabled / coming soon)
-> Domains dialog
-> Connect coding agent dialog
-> Switch workspace dialog
-> Log out

Team stays in the sidebar because it is a frequent collaboration surface. Inbox can remain visible as coming soon, but disabled until its workflow exists. Domains belongs in the workspace menu because it is workspace configuration for extension activation, not daily report work.

Workspace switching uses a quick hover submenu, and the create/join action opens a focused dialog:

```txt
Switch workspace hover submenu
-> current workspace with checkmark
-> other workspaces
-> Create or join workspace...

Create or join workspace click
-> opens a focused workspace dialog
-> current workspace with checkmark
-> no other workspaces / workspace list
-> Create new workspace
```

The Domains dialog is the admin control surface for allowed capture domains:

```txt
current domains
-> active / pending status
-> edit affordance
-> add new domain
```

The Connect coding agent dialog belongs in the workspace menu because it is
workspace configuration, like Domains. It connects the current workspace to a
coding agent over MCP and must make the workspace scoping obvious:

```txt
explain this connects the current workspace only, and the token acts as you
show the MCP endpoint URL with a copy control
generate a named personal access token, revealed once, with copy
show a ready-to-paste agent config snippet (url + Authorization: Bearer token)
list the caller's existing tokens with last-used and a revoke control
```

The dialog uses FeedMe's dark tactile form language, reuses the Domains dialog
shell, and shows the token/config in mono on sunken surfaces. See
`integration.md` "Coding Agent Access (MCP)" and `API_IMPLEMENTATION_GUIDE.md`
Slice 10 for the server side.
`MCP_DEVELOPER_WORKFLOW.md` owns the next developer workflow layer: report row
context menu actions, admin-authored implementation briefs, developer work
notes, and MCP presets.

The extension card should act like a small product teaser, not a generic upsell. It should borrow the active sidebar item surface language, stay gray/charcoal, and use a tonal install CTA that already feels slightly lifted at rest. Avoid icons, playful blue gradient washes, or terminal mockups here. The card should be dismissible with a small top-right close control and persist that dismissal in local storage.

Until FeedMe has a Chrome Web Store listing, the extension card opens the shared extension install dialog. The dialog downloads `public/downloads/feedme-extension.zip` and explains the manual Chrome flow: unzip, open `chrome://extensions`, enable Developer mode, and Load unpacked. The topbar Capture report CTA should open the same dialog so users who try to capture before installing are guided to the extension instead of hitting a dead button.

Topbar
-> search
-> primary Capture report CTA
-> compact utility icon buttons
-> controls the visibility of the right rail

Topbar search is a real workspace search control, not decorative chrome. It writes the shared `q` URL param with a short debounce and preserves route-owned params such as `view`, `sort`, `status`, `scope`, and `role`. Search should clear stale selected entity params (`report`, `member`) so the active page and right rail select the first visible match. The focused search field should stay visually quiet in the topbar; do not add a temporary background or border just because the input is active.

Search behavior:

```txt
Reports
-> match title, summary, domain, URL, reporter, assignee, selected element, status, severity, category, and developer prompt

My Work
-> same report matching, after the active Assigned/Reported scope

Team
-> match name, display name, email, role, status, title, and workload counts
```

If search or filters produce no visible rows, the main canvas owns the empty state and the right rail should not keep showing stale context from an item outside the current result set.

Dashboard interactions must feel local-first. Report row selection, report status filters, My Work scope tabs, Team role filters, and teammate/report selection should update visible UI state immediately and sync the URL with the native History API. Do not use App Router navigation for these micro-interactions because it can refetch server components and make clicks feel dead.

Production dashboard data rules:

```txt
TanStack Query owns backend data and cache
Zustand owns durable dashboard UI preferences only
URL search params own shareable route state
React local state owns temporary component details
```

Reports and My Work pages should read report summaries from the TanStack Query list cache. The workspace shell and right rail must not refetch the full reports list just to populate context. The right rail uses the selected report id from URL/dashboard state, renders cached summary context immediately, then fetches or reads the selected report detail query for screenshot evidence.

Team pages follow the same rule: members come from the team members query cache, and the Team right rail reads cached member state instead of making a second members request.

Zustand may store preferences such as right rail open state, sidebar collapsed state, density, and global dialog visibility. It must not store reports, report details, members, domains, session user, counts, invites, or MCP tokens.

On mobile/tablet, search becomes an icon-triggered sheet and the primary capture action remains in the topbar. The sidebar is replaced by a left sheet, and right-rail context is replaced by a right sheet.

Main content
-> route-owned page content
-> reports empty state for the first dashboard pass

Right rail
-> contextual metadata for the current surface or selected object
-> sits below the topbar, not beside it
-> can be hidden from a topbar button so the page content takes the full shell width
-> should animate with a slow, smooth grid/width transition instead of snapping in and out
```

The right rail is not a generic profile panel. It should change purpose by route:

```txt
/reports
-> list route with reports: default to the first report
-> list route with zero reports: do not render the right rail; the main empty state owns the starting point
-> selected report: severity, status, screenshots, assignee, browser/device, domain, selected element, prompt preview, open action
-> detail route: right rail is logically disabled and not rendered; the main canvas owns the full report

/my-work
-> current user's workload summary and assignment health

/team
-> team summary, or selected teammate workload and recent activity

/domains
-> selected domain health, report volume, capture status

/inbox
-> selected source/item metadata
```

Do not show user profile stats on Reports unless the current surface is explicitly user-owned work.

## Reports Route

Reports are FeedMe's home surface. Captured feedback lands here first, then becomes triaged work.

Report data should be structured enough to power triage and developer handoff:

```txt
id
title
summary
severity: low | medium | high | urgent
status: open | triaged | in_progress | resolved
type: bug | ux | copy | performance | accessibility
domain
url
browser
device
viewport
capturedAt
two screenshots: page and annotated
selectedElement: tag, selector, text, attributes
feedback: message, reporter name, reporter email
developerPrompt
assignee
commentsCount
```

Empty state requirements:

```txt
Small skeleton-style report illustration
Clear title
One sentence of context
Primary CTA: Capture your first report
Secondary learning link: How FeedMe works in 60s
```

The empty state should not feel broken or empty. It should feel like a guided starting point.

The report empty-state illustration should be a small skeleton-style mark inside the component, not a generated image tile. Keep it minimal: one dotted report rectangle, one plus marker, and a subtle blue shadow below.

When reports exist, `/[workspaceSlug]/reports` supports two index modes controlled from the topbar:

```txt
table view
-> default mode for the platform
-> scan mode for report queues
-> issue, priority, context, activity
-> uses the same neutral `P0-P3` priority code as cards instead of colorful severity pills

grid view
-> optional visual evidence mode
-> visual gallery of report evidence
-> card surface is the screenshot evidence, not a padded card containing an image
-> use the dual-evidence card direction: page context plus selected-element/annotated area inside one full-bleed image
-> top-left severity uses a neutral priority code instead of a colorful semantic pill
-> priority mapping is `urgent -> P0`, `high -> P1`, `medium -> P2`, `low -> P3`
-> colorful semantic severity labels are reserved for explanatory surfaces such as the right rail and report detail
-> the issue title remains one-line truncated in every state so screenshot evidence keeps priority
-> hover/focus smoothly reveals owner, domain, and captured time without expanding title height
-> selected state keeps the hover metadata revealed and uses a subtle FeedMe-blue hairline, not a heavy outline or filled blue card
-> include a compact bottom-right open-report arrow for direct navigation to the report detail; the arrow uses its own neutral lifted button state and does not inherit selected-card blue styling
-> grid should be responsive with comfortable card sizes, reaching four cards per row with the rail open and up to five on wide canvases when the rail is hidden
```

Table is the default because FeedMe is an operations dashboard. Developers and teams need fast scanning, bulk triage, sorting, and filtering first. Grid view exists because reports are visual evidence; users can switch to it when recognizing issues from screenshots is faster than reading rows.

The table index should stay compact:

```txt
title + summary
priority code
type
domain
owner
captured time
comment count
open action
```

Do not put screenshots, selected-element blocks, or developer prompt previews inside the table row. Those are evidence/detail surfaces and belong in the right rail or report detail route.

The reports list should select the first report by default. Clicking a table row or grid card changes the selected report and updates the right rail. The selection and view mode may be represented in the URL query string so it is shareable and does not require hidden local state.

User identities in report surfaces use the shared FeedMe avatar wrapper. Assignees and reporters should render uploaded/profile images first. If no image exists, fall back to deterministic `avvvatars-react` shape avatars from email when available, or from name when email is unavailable. Unassigned owner states stay neutral and should not look like a real person.

When the right rail is hidden on the reports index, the shell must keep a zero-width second grid column during the transition. Do not collapse the grid to one column while the rail is still rendered, because the rail can wrap below the report cards and create a visible ghost panel.

The right rail on `/[workspaceSlug]/reports` is a selected-report inspector:

```txt
selected report title and summary
severity/status badges as solid semantic pills with white text and tactile depth
single full-width screenshot evidence with Page/Element tabs instead of showing both screenshots at once
expanded screenshot viewer from the evidence frame: fullscreen icon opens an image-first dialog, arrows move between the two images, and title/count/dimensions/captured time float over the image on a soft top gradient; avoid extra metadata boxes below the viewer
owner/captured/comment metadata
selected element
developer prompt preview
Open report action
```

While report data is loading, the Reports right rail should reserve the final selected-report inspector layout with a premium skeleton. Match the final badge row, title/summary block, evidence tabs, screenshot frame, open action, metadata grid, selected element block, and developer prompt block so there is no visible jump when the first report resolves.

Opening a report leads to `/[workspaceSlug]/reports/[reportId]`. The detail route should give the main canvas to the report itself: screenshot evidence, full feedback, selected element data, metadata, and the full developer prompt. Avoid adding another internal right-side report panel on the detail page. The workspace shell should not render the right rail or right-rail toggle on report detail routes. Detail screenshot cards use the same expanded evidence viewer pattern as the rail: an image-first dialog with floating controls over a top gradient. Workflow controls on the detail page should use the same compact tactile charcoal menu and secondary raised action language as the report inspector rail.

Report detail uses three tabs so the page stays focused:

```txt
Evidence
Activity / Notes
Implementation brief
```

Evidence and Activity / Notes are visible to every member who can open the report. Implementation brief is visible only to owners/admins and contains the editable handoff fields from `MCP_DEVELOPER_WORKFLOW.md`: acceptance criteria, implementation notes, constraints/non-goals, expected behavior, reference links, and review checklist. The right rail should not absorb these fields; it remains for quick inspection and workflow actions.

The report detail tab control should be quiet and line-based: active text with a thin bottom rule, not a framed segmented control. Switching between these tabs is local UI state plus URL search-param replacement and must not trigger a server round-trip or full route loading state.

Implementation brief must not be a dump of generic textareas. Use structured controls that match the data:

```txt
left top: expected behavior -> focused textarea
left bottom: review checklist -> editable list rows
right top: implementation plan -> focused textarea backed by implementationNotes
right bottom: reference links -> label + URL rows
```

`acceptanceCriteria` and `constraintsNonGoals` stay in the schema/API/MCP contract, but they are hidden in the dashboard UI for now. They are optional fields reserved for deeper workflow maturity; do not surface them until they solve a real product problem.

Activity / Notes owns the future comments and work-notes stream. It should not repeat status, owner, captured time, or other metadata already visible in the report header.

## My Work Direction

My Work should mean "work involving me," not only "reports submitted by me" and not only "tasks assigned to me." A developer can submit reports, and a reporter may not have assigned implementation work, so the page should be role-aware without changing its identity.

Recommended structure:

```txt
/[workspaceSlug]/my-work
-> default table/list view
-> optional card/grid view for visual browsing
-> right-aligned segmented scope using the same tactile tab language as the report evidence Page/Element switch:
   Assigned to me
   Reported by me
```

Assigned to me is the developer/operator view:

```txt
reports or tasks I own
status
priority
domain
last activity
next action
```

Reported by me is the reporter/contributor view:

```txt
feedback I submitted
current status
owner
domain
comments/activity
captured time
```

If a user has no developer role, the page can default to Reported by me and keep Assigned to me as an empty/guided tab. If a user has developer responsibilities, Assigned to me should be the first scope because it is the action queue.

Implementation note: My Work is backed by the report ownership fields. Assigned to me filters reports where `assigneeUserId` is the signed-in user, and Reported by me filters reports where `reporterUserId` is the signed-in user. Developers default to Assigned to me; other roles default to Reported by me.

The My Work right rail must be scoped to the active My Work tab. If the active scope has reports, the rail shows the selected visible report and falls back to the first visible report when the URL has no valid `report` parameter. If the active scope is empty, the right rail should be disabled so the empty state owns the full canvas.

Owners and admins can assign the selected report directly from the report inspector rail. The assignment block belongs below the evidence viewer and Open report action, not above the screenshot context. The assignee picker should use the same compact tactile charcoal menu language as report sorting, list active developers and designers, and avoid generic native/Radix-looking select styling. Saving assignment is a secondary raised action, not a primary blue CTA. Saving should immediately update the selected report and make it appear in that member's Assigned to me scope.

Developers and designers should also be able to operate from the same selected-report rail. If the selected report is assigned to the signed-in member, show compact secondary actions below Open report so they can Start work and mark Ready for review without opening the detail route.

The right rail on My Work should summarize personal workload and selected-item context:

```txt
selected report/task details
my open count
urgent count
blocked/in-progress count
recent activity involving me
```

The My Work main surface should reuse the Reports table/card language instead of inventing a new visual system. Tables use neutral priority codes and compact rows. Cards use full-bleed evidence previews only when the user switches to grid mode. Because My Work items are still reports, selecting a row/card should use the same report inspector rail as the Reports route.

## Team Direction

Team represents workspace membership created through invites. A member joins by using an invite code/link, then can be assigned a role.

```txt
/[workspaceSlug]/team
-> default table/list view
-> Invite member CTA
-> role/status filters:
   All
   Developers
   Designers
   Reporters
   Pending
-> member rows
```

Team table should stay operational and compact:

```txt
member
role
assigned/open work
reports submitted
joined date
```

Member rows and selected-member right rails use the shared FeedMe avatar wrapper. Prefer `avatarUrl` from the user profile. If no image exists, use `avvvatars-react` shape fallback with member email as the stable value. Keep avatars circular with FeedMe hairline border and subtle dashboard shadow so they feel native to the charcoal shell.

Team does not need a card/grid switch. It is a membership and permissions surface, so the table is the product shape. Do not add an actions column to the table; member actions should live in the right rail after a teammate is selected.

Roles are product permissions, not visual personas:

```txt
admin/owner
developer
reporter
viewer
```

The right rail on Team should change based on selection:

```txt
no selected member
-> team summary, seats, pending invites

selected member
-> member profile
-> role management
-> assigned work
-> reports submitted
-> recent activity
```

While teammate data is loading, the Team right rail should reserve the final selected-member layout with a premium skeleton. Match the final avatar, name/email stack, role pills, metrics grid, and context block so there is no visible jump when the data resolves.

Invite flow should remain simple at this stage:

```txt
open invite dialog
choose default role
send one or more email invites
generate/copy role-scoped invite link or code
optionally show pending invites later
```

Invite entry points:

```txt
sidebar Invite member button
Team header plus icon
```

Both entry points should open the same shared dialog. The dialog should stay compact and use FeedMe's dark tactile form language: Email and Invite code tabs, role selection, copy code, and copy invite link.

## Mock Data Strategy

Until there is a backend, dashboard pages read from mock helpers:

```txt
src/lib/mock/dashboard.ts
```

The UI should depend on helper functions such as:

```txt
getMockWorkspace(slug)
getMockReports(slug)
```

Later, those helpers can be replaced by real server queries without rewriting the layout or page components.

## Implementation Rules

- `design.md` remains the source of truth for visual tokens.
- Dashboard components live under `src/components/feedme/dashboard`.
- Route files should stay thin and route-owned.
- The workspace shell owns sidebar, topbar, and right rail.
- Individual pages own only their main content.
- Avoid hard-coded colors. Use tokens and CSS variables from `globals.css`.
- Do not build future pages until we explicitly start that page.
