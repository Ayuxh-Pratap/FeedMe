# FeedMe Frontend Data Architecture

This file defines the production frontend data model for FeedMe. It exists so the dashboard feels like a market-ready SaaS product, not a collection of page-local fetches.

Read this with:

- `API_IMPLEMENTATION_GUIDE.md` for backend contracts.
- `DASHBOARD.md` for dashboard behavior and visual structure.
- `integration.md` for extension, reports, and workflow rules.
- `design.md` for UI source of truth.

## Goal

FeedMe should feel instant for normal dashboard work:

```txt
open reports
select a report
switch tabs or scopes
assign a developer
start work
mark ready for review
resolve a report
return to a list
notice new reports
```

Those interactions should update the UI immediately, keep data correct, and avoid full route refreshes.

## Ownership Model

Use four separate state layers.

```txt
Backend and database
-> source of truth for users, workspaces, reports, members, domains, comments, assets

TanStack Query
-> source of truth for fetched server state in the browser

URL search params
-> source of truth for shareable route state

Zustand
-> source of truth for durable dashboard UI preferences and cross-component UI coordination

React local state
-> source of truth for temporary component-only state
```

Do not merge these layers.

## Server State: TanStack Query

Use TanStack Query for every backend-backed resource:

```txt
current session/bootstrap
workspace list
workspace metadata
reports list
report detail
report counts
my work
team members
workspace domains
invites
MCP tokens
assignment mutations
status mutations
domain mutations
```

TanStack Query owns:

```txt
caching
stale time
background refetch
focus refetch
polling
pagination
prefetch
optimistic updates
rollback on mutation failure
targeted invalidation
```

Do not store server entities in Zustand.

Forbidden in Zustand:

```txt
reports
report details
screenshots
members
domains
workspaces
session user
current role
counts
comments
invites
MCP tokens
```

These are server state and belong in TanStack Query.

## Query Keys

Use a single query key factory so cache ownership stays obvious.

Recommended shape:

```ts
const workspaceKeys = {
  all: ["workspace"] as const,
  bySlug: (slug: string) => [...workspaceKeys.all, slug] as const,
  members: (slug: string) => [...workspaceKeys.bySlug(slug), "members"] as const,
  domains: (slug: string) => [...workspaceKeys.bySlug(slug), "domains"] as const,
  invites: (slug: string) => [...workspaceKeys.bySlug(slug), "invites"] as const,
  tokens: (slug: string) => [...workspaceKeys.bySlug(slug), "tokens"] as const,
}

const reportKeys = {
  all: (slug: string) => [...workspaceKeys.bySlug(slug), "reports"] as const,
  list: (slug: string, filters: ReportListFilters) =>
    [...reportKeys.all(slug), "list", filters] as const,
  detail: (slug: string, reportId: string) =>
    [...reportKeys.all(slug), "detail", reportId] as const,
  counts: (slug: string, filters: ReportCountFilters) =>
    [...reportKeys.all(slug), "counts", filters] as const,
  myWork: (slug: string, filters: MyWorkFilters) =>
    [...reportKeys.all(slug), "my-work", filters] as const,
}
```

Rules:

```txt
query keys must include workspace slug
list keys must include every backend filter
detail keys must be by report id
counts are separate from list pages
mutation hooks must update all affected report keys
```

## URL State

Use URL search params for state that should survive refresh, copy/paste, and browser back/forward:

```txt
q
report
member
status
scope
sort
view
role
cursor when explicitly navigable
```

For micro-interactions such as selecting a report, changing status tabs, changing My Work scope, and changing table/grid view, update the client state first and then sync the URL with the native History API.

This avoids unnecessary server component refetches while keeping `usePathname` and `useSearchParams` in sync.

## Zustand UI Store

Use Zustand for concrete dashboard UI state that is not owned by the backend and is useful across components.

Recommended store:

```txt
src/stores/dashboard-ui-store.ts
```

Allowed persisted state:

```txt
rightRailOpenByWorkspace
sidebarCollapsedByWorkspace
reportDensityByWorkspace
lastNonUrlReportViewByWorkspace
lastMyWorkScopeByWorkspace
extensionInstallDismissedAt
```

Allowed non-persisted state:

```txt
commandMenuOpen
mobileSidebarOpen
mobileSearchOpen
extensionInstallDialogOpen
activeGlobalDialog
```

Rules:

```txt
URL wins over Zustand when both can express the same state
Zustand stores UI preferences, not data records
Zustand persisted state must be versioned
Zustand persisted state must tolerate missing workspace ids/slugs
Zustand selectors should be narrow to avoid broad rerenders
```

Tab persistence rule:

```txt
If the URL has an explicit tab/scope/filter param, the URL wins.
If the URL does not specify a workspace-local preference, Zustand may restore
the last used preference for that workspace.

Example:
-> /:workspaceSlug/my-work?scope=assigned always opens Assigned to me
-> /:workspaceSlug/my-work may restore the last My Work scope for that workspace
-> changing My Work scope updates both the URL and lastMyWorkScopeByWorkspace
```

Example:

```ts
type DashboardUiState = {
  rightRailOpenByWorkspace: Record<string, boolean>
  sidebarCollapsedByWorkspace: Record<string, boolean>
  commandMenuOpen: boolean
  setRightRailOpen: (workspaceSlug: string, open: boolean) => void
  setSidebarCollapsed: (workspaceSlug: string, collapsed: boolean) => void
  setCommandMenuOpen: (open: boolean) => void
}
```

Do not create a generic app store with everything inside it.

## React Local State

Use component state for short-lived UI details:

```txt
input draft before debounce
dropdown open state
hover state
button pending visual state when the mutation hook already owns the mutation
form field errors before submit
sheet animation state
```

If state is not useful outside one component and should disappear when the component unmounts, keep it local.

## Report List And Detail UX

Reports list should render from the list query immediately.

Route-level rule:

```txt
Reports, My Work, and Team list routes must not block navigation on server-side
list/member fetches. The route should render the client surface quickly, then the
surface reads from TanStack Query. This lets back/forward navigation show cached
rows immediately.

If the server page awaits listWorkspaceReports, listWorkspaceMembers, or duplicate
workspace role/session work before rendering, the user still sees route loading
before the Query cache can help.
```

Route loading boundary rule:

```txt
Do not add loading.tsx boundaries to Reports, My Work, or Team list routes while
their data is owned by client queries. A route-level loading boundary cannot see
the browser query cache, so it will flash skeletons even when cached rows are
available. Let the page body show first-load skeletons and let cached navigation
render immediately.
```

Right rail behavior:

```txt
selected report id comes from URL or first visible report
summary data comes from the reports list cache
detail query starts in the background and must fetch the full detail contract
rail renders summary immediately
screenshots and developer prompt hydrate when detail arrives
detail response updates the report detail cache and may patch summary caches
if element evidence is not in the summary yet, show an intentional evidence
hydration state instead of a blank screenshot frame
```

Important detail hydration rule:

```txt
List summaries may contain only one lightweight page screenshot.
Do not put a list summary into the detail query as initialData, because Query will
treat that partial summary as the real detail result. Use placeholderData instead,
so the rail/detail page can render immediately while the full detail contract still
fetches all screenshots and evidence.
```

Opening and closing detail pages:

```txt
prefetch detail on deliberate report selection and explicit open
do not prefetch on hover; cursor movement should not create report detail traffic
detail page should use cached detail when available
returning to list should show cached rows instantly
list can background-refetch after paint
```

Evidence cache rule:

```txt
List summaries are allowed to be lightweight, but a full detail response must
upgrade every cached copy of that report. A later summary or optimistic mutation
must not replace a richer screenshot set with a one-screenshot summary.

Detail cache patching must be report-id guarded. A mutation or detail response
for report B may patch report B's detail cache and any list row whose id is B,
but it must never merge into report A's detail cache just because both cache
entries have a `report` property.

When merging cached reports, preserve the richer evidence set by screenshot
source count/quality unless the incoming report is equally rich or richer.
```

No empty click should feel dead. If a refetch is happening, show a thin progress signal or subtle refreshing indicator without replacing already-visible content.

## Mutations

Report workflow mutations must be optimistic:

```txt
assign developer
unassign developer
start work
mark ready for review
resolve
archive
```

Assignment lock rule:

```txt
Assignment controls are editable while a report is unstarted or only assigned.
Once a report is in_progress, ready_for_review, resolved, or archived, the UI
must show assignment as locked. The API enforces the same rule, so the frontend
should not offer a normal save-assignment action for locked reports.
```

Mutation flow:

```txt
cancel affected queries
snapshot previous cached reports/details/counts
optimistically patch list caches and detail cache
show inline pending state
send request
replace optimistic data with server response
invalidate affected counts and stale lists in background
rollback on failure
```

Do not call `router.refresh()` after report workflow mutations.

The mutation response should be enough to reconcile the UI:

```txt
report
event
changedAt
```

If the server needs to preserve correctness, it may return the full report detail. If latency becomes visible, prefer returning a mutation delta and background-refetching detail.

## Team Members

Team members are server state and must use the shared members query:

```txt
GET /api/workspaces/:workspaceSlug/members
query key: workspaceKeys.members(workspaceSlug)
```

The Team route, report assignment rail, and any future member picker should read
from the same query hook. Do not manually fetch members in a component effect when
the shared query exists; doing so creates duplicate loading states and bypasses
cache reuse.

Team member metrics:

```txt
assignedCount -> active work currently assigned to the teammate
completedCount -> resolved reports owned by that teammate
reportsCount -> reports submitted by that teammate
```

Do not use `assignedCount` for lifetime assignments. Completed work belongs in
`completedCount`.

## Pagination

Use backend pagination. The dashboard must not fetch every report and filter in the browser.

Current MVP pagination may use an opaque cursor, but the production target is keyset pagination:

```txt
newest: capturedAt + id
oldest: capturedAt + id
priority: severity rank + capturedAt + id
comments: commentsCount + capturedAt + id
```

The API cursor should be opaque to the client.

## Counts

Use the dedicated counts contract. Do not derive tab totals from the current page.

Recommended:

```txt
GET /api/workspaces/:workspaceSlug/reports/counts?q=&scope=
```

Returns:

```txt
all
open
inProgress
resolved
assignedToMe
reportedByMe
```

Counts are cached separately and invalidated after report create/status/assignment mutations.

## Freshness And Auto Updates

MVP freshness:

```txt
focus refetch reports and my work
poll active report list every 10-15 seconds while the tab is visible
poll selected detail less frequently or only on focus
background refetch must not dim, disable, or visually reload an already-rendered list
show "New reports available" when the incoming first page has unseen ids
let the user apply new reports instead of jumping the list while they are reading
```

Later realtime:

```txt
SSE or managed pub/sub for report.created and report.updated events
workspace-scoped event stream
event carries report id, type, version, changedAt
client invalidates or patches matching queries
```

Webhooks are not the right mechanism for dashboard tabs. Webhooks notify servers, not open browsers.

## Backend Support Needed

To make the frontend feel professional, the backend should expose:

```txt
separate list/detail/counts contracts
stable opaque cursors
workspace-scoped indexes for filters
updatedAt or version on reports
mutation responses that include the updated report or mutation delta
event timestamps for future realtime
Cloudinary thumbnails for list/rail surfaces
full Cloudinary URLs for detail viewers
```

Search should eventually cover:

```txt
title
summary
domain
URL
reporter
assignee
selected element selector/text
status
severity
category
developer prompt
```

## Dependency Policy

Approved frontend data dependencies:

```txt
@tanstack/react-query
zustand
```

Do not add Redux for the dashboard data layer. It would push us toward manually maintaining server data, invalidation, optimistic rollback, pagination, and background refresh. TanStack Query is the correct ownership boundary for server state.

Use Zustand only for UI state that is not backend-owned.

## Production Readiness Bar

This architecture is ready when:

```txt
reports list returns from cache on back navigation
right rail changes selected report instantly
detail evidence hydrates without blanking summary content
assignment/status updates reflect instantly across list, rail, detail, and my work
failed mutations roll back cleanly with visible error messaging
status/count tabs show exact backend totals
new reports appear through polling or realtime without hard reload
no report workflow action calls router.refresh()
no backend entities live in Zustand
no random component fetches bypass query hooks
```

Current implementation status:

```txt
implemented query-backed resources:
-> reports list/detail/counts
-> my work
-> team members
-> workspace domains
-> invite creation/list cache
-> MCP tokens

remaining architecture direction:
-> keep any new backend-backed dashboard surface behind a query hook first
-> do not add new component-local fetch/effect islands for server resources
```

If those are true, FeedMe will feel like a serious product instead of a slow admin panel.

## Loading Handoff Rule

Every route must avoid the blank-canvas gap:

```txt
bad: route skeleton -> blank canvas -> data
good: route skeleton -> page body skeleton -> data
best with cache: cached data -> silent background refresh -> updated data
```

List surfaces should follow this render order:

```txt
if first load and no cached rows:
  show a layout-matching body skeleton

if cached rows exist and query is refetching:
  keep rows visible with no dimming or disabling

if fetch finished and zero rows:
  show the route's empty state

if rows exist:
  show rows
```

Never use a 1px loading bar as the only first-load body state for a large route surface.

## Phase 2: Market Readiness Context

Implementing this architecture does not make FeedMe 100% public-market ready by itself. It solves one of the biggest product-killing issues: the dashboard feeling slow, dead, and side-project-ish.

After this architecture is implemented well:

```txt
controlled team beta: yes, very likely ready
investor/demo readiness: yes, much stronger
public market launch: not yet 100%
```

The data architecture gets FeedMe to a professional product feel. The remaining Phase 2 readiness work is:

```txt
Performance and UX
-> TanStack Query + Zustand + optimistic mutations + polling/realtime awareness
-> no dead clicks across Reports, My Work, Team, Domains, and Extension

Reliability
-> clear error states
-> retry behavior
-> empty states
-> polished loading states

Security
-> workspace isolation audit
-> role checks audit
-> session security audit
-> PAT security for MCP
-> extension trust model audit
-> upload validation audit
-> no cross-workspace leakage

Production Ops
-> logs
-> error tracking
-> database backup confidence
-> migration safety
-> rate limiting
-> basic monitoring

Extension Distribution
-> clean download/install flow with instructions for internal MVP
-> Chrome Web Store publishing path for public market launch

Core Workflow Completion
-> signup
-> create workspace
-> add domain
-> invite teammate
-> install extension
-> capture report
-> see report instantly
-> assign developer
-> developer starts work
-> developer marks ready
-> admin resolves

Polish Pass
-> skeletons
-> mobile right rail
-> report detail workflow panel
-> install extension flow
-> dashboard responsiveness
```

The honest product milestone is:

```txt
data architecture implemented -> market-beta ready
data architecture + Phase 2 QA/security/ops/polish -> confident public launch path
```
