# Dashboard Foundation

This file captures the dashboard direction for FeedMe. It should be read with `design.md` as the visual source of truth and `PROJECT_VISION.md` as the product source of truth.

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

## Dashboard Regions

```txt
Workspace sidebar
-> workspace switcher
-> Inbox
-> Reports
-> My Work
-> Team
-> Domains
-> extension education card

The extension card should act like a small product teaser, not a generic upsell. It should borrow the active sidebar item surface language, stay gray/charcoal, and use a tonal install CTA that already feels slightly lifted at rest. Avoid icons, playful blue gradient washes, or terminal mockups here. The card should be dismissible with a small top-right close control and persist that dismissal in local storage.

Topbar
-> search
-> primary Capture report CTA
-> compact utility icon buttons
-> controls the visibility of the right rail

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
-> list route: default to the first report, or show selection guidance if there is no report
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
grid view
-> default mode
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

table view
-> scan mode for large queues
-> issue, priority, context, activity
-> uses the same neutral `P0-P3` priority code as cards instead of colorful severity pills
```

Grid is the default because FeedMe reports are visual evidence. Developers should be able to recognize a report from the captured image before reading every title. Table view exists for fast scanning, bulk triage, and future filtering.

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

Opening a report leads to `/[workspaceSlug]/reports/[reportId]`. The detail route should give the main canvas to the report itself: screenshot evidence, full feedback, selected element data, metadata, and the full developer prompt. Avoid adding another internal right-side report panel on the detail page. The workspace shell should not render the right rail or right-rail toggle on report detail routes. Detail screenshot cards use the same expanded evidence viewer pattern as the rail: an image-first dialog with floating controls over a top gradient.

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
