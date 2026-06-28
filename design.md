---
version: 0.1.0
name: FeedMe Charcoal Design System
description: A premium dark SaaS interface language for FeedMe, built around charcoal surfaces, tactile controls, restrained electric-blue action states, and calm feedback workflows.
colors:
  surface-shell: "#0F1012"
  surface-panel: "#15161C"
  surface-page: "#15161C"
  surface-sunken: "#15161C"
  surface-card: "#0F1012"
  surface-raised: "#2E3138"
  surface-hover: "#262626"
  surface-divider: "#0A0A0A"
  fill-translucent: "rgba(255,255,255,0.03)"
  fill-subtle: "rgba(255,255,255,0.05)"
  fill-nav-active: "linear-gradient(0deg, rgba(28,138,248,0.05), rgba(28,138,248,0.05)), linear-gradient(0deg, rgba(255,255,255,0.05), rgba(255,255,255,0.05)), #2E3138"
  primary: "#0080F0"
  primary-alt: "#1C8AF8"
  primary-soft: "#3C82F7"
  success: "#34C759"
  error: "#FF3B30"
  warning: "#F5A623"
  warning-alt: "#F59E0B"
  text-primary: "#FFFFFF"
  text-secondary: "#D4D4D4"
  text-body: "#A3A3A3"
  text-muted: "#737373"
  border-hairline: "rgba(255,255,255,0.05)"
  border-subtle: "rgba(255,255,255,0.08)"
  border-strong: "rgba(255,255,255,0.15)"
  slack-red: "#E01E5A"
  slack-blue: "#36C5F0"
  slack-green: "#2EB67D"
  slack-yellow: "#ECB22E"
typography:
  heading-1:
    fontFamily: "Saans, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "32px"
    lineHeight: "40px"
    fontWeight: 600
    letterSpacing: "-0.0094em"
  heading-2:
    fontFamily: "Saans, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "24px"
    lineHeight: "32px"
    fontWeight: 600
    letterSpacing: "-0.0094em"
  heading-3:
    fontFamily: "Saans, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "20px"
    lineHeight: "28px"
    fontWeight: 600
    letterSpacing: "-0.0094em"
  heading-5:
    fontFamily: "Saans, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "14px"
    lineHeight: "20px"
    fontWeight: 500
    letterSpacing: "-0.0094em"
  body-1:
    fontFamily: "Saans, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "16px"
    lineHeight: "24px"
    fontWeight: 400
    letterSpacing: "-0.0094em"
  body-2:
    fontFamily: "Saans, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "14px"
    lineHeight: "20px"
    fontWeight: 400
    letterSpacing: "-0.0094em"
  body-3:
    fontFamily: "Saans, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "12px"
    lineHeight: "16px"
    fontWeight: 400
    letterSpacing: "-0.0094em"
  caption:
    fontFamily: "Saans, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "10px"
    lineHeight: "14px"
    fontWeight: 400
    letterSpacing: "-0.0094em"
  annotation:
    fontFamily: "Caveat, cursive"
    fontSize: "18px"
    lineHeight: "24px"
    fontWeight: 500
  mono:
    fontFamily: "ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, Liberation Mono, monospace"
    fontSize: "12px"
    lineHeight: "16px"
    fontWeight: 500
rounded:
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "16px"
  pill: "22px"
  full: "9999px"
spacing:
  1: "4px"
  2: "8px"
  3: "12px"
  4: "16px"
  5: "20px"
  6: "24px"
  8: "32px"
  10: "40px"
  12: "48px"
  16: "64px"
  sidebar-width: "260px"
  topbar-height: "64px"
  right-rail-width: "320px"
  page-gutter: "24px"
components:
  app-shell:
    background: "{colors.surface-shell}"
    foreground: "{colors.text-secondary}"
  main-panel:
    background: "{colors.surface-page}"
    borderColor: "{colors.border-hairline}"
    borderRadius: "{rounded.xl}"
  sidebar:
    width: "{spacing.sidebar-width}"
    background: "{colors.surface-shell}"
    borderColor: "{colors.border-hairline}"
  topbar:
    height: "{spacing.topbar-height}"
    background: "{colors.surface-panel}"
    borderColor: "{colors.border-hairline}"
  button-primary:
    background: "linear-gradient(rgba(255,255,255,0.10) 0%, rgba(255,255,255,0) 50.48%), {colors.primary}"
    foreground: "{colors.text-primary}"
    borderRadius: "{rounded.lg}"
  button-secondary:
    background: "{colors.fill-translucent}"
    foreground: "{colors.text-secondary}"
    borderRadius: "{rounded.md}"
  input:
    background: "{colors.surface-sunken}"
    foreground: "{colors.text-primary}"
    placeholder: "{colors.text-muted}"
    borderColor: "{colors.surface-hover}"
    borderRadius: "{rounded.md}"
    labelStyle: "{typography.body-3}"
    textStyle: "{typography.body-3}"
    placeholderStyle: "{typography.body-3}"
  nav-active:
    background: "{colors.fill-nav-active}"
    foreground: "{colors.text-primary}"
    borderRadius: "{rounded.md}"
  card:
    background: "{colors.surface-card}"
    borderColor: "{colors.border-hairline}"
    borderRadius: "{rounded.xl}"
---

## Overview

FeedMe is a feedback operations dashboard, not a marketing site. The interface should feel like a focused command center for capturing website feedback, reviewing reports, assigning work, tracking domains, and managing teammates.

The visual reference is a premium charcoal SaaS product: dark, layered, tactile, quiet, compact, and precise. The base mood is grey-black and graphite, not blue-black. Blue is reserved for actions, active states, focus, and product meaning. Every screen should feel calm even when it contains operational data.

This file is the design source of truth. Shadcn components must mirror these tokens through CSS variables and component variants. If implementation and this document disagree, update this document first, then mirror it in code.

## Colors

Use charcoal surfaces as the foundation:

- Shell: `#0F1012` for the persistent app frame, card-like chrome, and sidebars.
- Panel: `#15161C` for top bars, docked controls, and quiet dashboard regions.
- Page: `#15161C` for the main workspace canvas and full-page backgrounds.
- Sunken: `#15161C` for inputs, search fields, empty-state wells, and recessed controls.
- Card: `#0F1012` for cards, login panels, dialogs, and focused form containers.
- Raised: `#2E3138` for selected navigation, secondary buttons, and tactile cards.
- Divider: `#0A0A0A` for deep structural separation.

Use `#0080F0` as the main FeedMe blue. It should appear on primary CTAs, selected tab underlines, active nav icons, capture affordances, focus rings, and meaningful report markers. Avoid washing the UI with blue gradients or large blue panels.

Status colors are semantic and rare:

- Green `#34C759` for online, synced, completed, and healthy states.
- Red `#FF3B30` for destructive actions, failed capture, or blocked reports.
- Amber `#F5A623` / `#F59E0B` for pending, warning, connecting, or needs-review states.

Text follows a strict hierarchy:

- Primary text: `#FFFFFF` for headings, active labels, and key values.
- Secondary text: `#D4D4D4` for button labels and important supporting labels.
- Body text: `#A3A3A3` for descriptions and metadata.
- Muted text: `#737373` for placeholders, inactive icons, and low-priority hints.

## Typography

Use `Saans` as the primary product typeface. If unavailable during development, use a system sans fallback, but keep metrics close to the tokens in frontmatter. Use medium and semibold weights sparingly so the interface stays clean.

Use `Caveat` only for rare human annotations, such as onboarding callouts or dotted guide notes. It should never be used for core UI labels, dashboard data, navigation, tables, or buttons.

Use mono only for code snippets, copied agent prompts, timestamps, IDs, and technical install commands.

Type should stay compact and operational. Dashboard panels, cards, tables, and side rails should use `body-2`, `body-3`, and `heading-5`. Reserve `heading-1` and `heading-2` for onboarding pages, empty states, and major page titles.

Compactness is a product rule, not a one-page tweak. Prefer the smallest comfortable control size, tight but readable field groups, and reduced vertical gaps. Forms should feel precise and premium, never inflated. If a screen starts to feel oversized, reduce spacing and type scale before changing the layout.

## Layout

The default dashboard layout has four structural regions:

- Left sidebar: fixed width around `260px`, persistent navigation, workspace switcher, helper card, and trial or plan status.
- Top bar: fixed height around `64px`, global search, scoped filters, view toggles, notifications/help, and the primary capture action.
- Main workspace: flexible content area with reports, empty states, work queues, domain pages, and detail panels.
- Optional right rail: around `320px`, used for profile summary, team context, report metadata, activity, or assignment details.

Preserve strong separation of concerns. Navigation belongs in the sidebar, global actions belong in the top bar, primary page content belongs in the main workspace, and contextual metadata belongs in the right rail.

Avoid information overload. Reports, teams, domains, inbox, and operations should use dedicated views instead of cramming every metric into one page. Prefer progressive disclosure: overview first, detail after selection.

Onboarding uses a split composition: form on the left, contextual product preview on the right. The left side should have generous negative space and a narrow form column. The right side may show a feedback widget, next-step list, captured report preview, or member collaboration preview.

## Elevation & Depth

The product should feel tactile without looking glossy or noisy. Depth comes from small shadow stacks, inset highlights, subtle borders, and controlled gradients.

Primary buttons use a physical treatment:

```css
background: var(--gradient-primary-premium);
box-shadow:
  var(--elevation-primary-premium);
text-shadow: var(--text-shadow-button);
```

Primary CTA buttons may include a single 1px top glint using `--gradient-button-glint`. Use this treatment for high-confidence actions such as Continue, Create workspace, Capture report, and first empty-state CTAs. Do not use it for social auth, secondary actions, sidebar nav, tables, or small utility controls.

The FeedMe brand mark may use the same premium radial fill, glint, and elevation as primary CTAs so the icon feels dimensional and intentional. Keep this treatment to the product mark and primary action surfaces; do not apply it to routine navigation icons.

Secondary buttons and icon buttons use translucent charcoal fills, a hairline ring, an inset top highlight, and a small drop shadow. Hover may increase the highlight and lift slightly, but it must not shift the control into blue unless the control is already a primary blue action. Active press scales to `0.97`. Clickable controls use `cursor: pointer`; disabled controls opt out.

Button hover backgrounds must come from paired gradient tokens: premium primary CTAs use `--gradient-primary-premium-hover`; regular primary controls may use `--gradient-primary-hover`; secondary and icon controls use `--gradient-secondary-hover`. For gradient buttons, blend the hover state through an opacity-transitioned overlay instead of swapping the `background` value directly, because direct gradient changes feel abrupt. Do not freeze hover backgrounds, and do not rely on shadcn default hover colors for FeedMe tactile buttons.

Large cards and panels should use subtle borders and dark fill, not heavy shadows. Dialogs and floating widgets may use stronger shadows because they sit above the app shell.

## Shapes

Use a small, consistent radius scale:

- `6px`: small chips, checkboxes, compact badges.
- `8px`: nav rows, inputs, icon buttons, table controls.
- `10px`: main CTAs and split buttons.
- `16px`: panels, cards, dialogs, media containers.
- `22px`: pill controls and segmented toggles.
- `9999px`: avatars, status dots, circular FABs.

Cards should not be nested inside decorative cards. Page sections should be full-width regions or clean unframed layouts. Cards are for repeated records, dialogs, report previews, media blocks, and focused tool surfaces.

## Components

Build with shadcn primitives and local variants. Shadcn is the implementation substrate; this design system is the source of truth.

Required mappings:

- `Button`: primary, secondary, ghost, destructive, icon, split action.
- `Input` / `Textarea`: sunken charcoal fill, thin hairline border, compact labels. Focus changes only the border to a stronger neutral line; no blue focus ring, glow, or extra shadow. Labels, input values, and placeholders use `body-3`; labels use medium weight while values stay regular. Small dividers and secondary metadata use `caption`.
- `Dialog` / `Sheet`: dark translucent overlay, raised charcoal panel, strong but soft shadow.
- `Tabs`: understated labels with blue underline for active state.
- `Card`: restrained panel with `16px` radius and hairline border.
- `Avatar`: circular, with optional green presence dot.
- `Badge`: compact status indicators using semantic colors only.
- `Table`: dense but breathable report lists with hover rows and muted metadata.
- `DropdownMenu` / `Command`: charcoal surfaces, sharp text hierarchy, no bright menu backgrounds.
- `Tooltip`: dark raised surface, concise text, used for icon-only controls.

Sidebar nav rows should have icons, labels, and optional counts. Active rows use the layered blue-grey selected gradient and a subtle inset glow. Hover rows use translucent white fill, not blue.

Top bar search should feel like a command input: sunken surface, search icon, optional workspace/person scope pill, and keyboard hint when useful.

Empty states should be useful, not decorative. A report empty state may include a single dimensional capture illustration, a clear title, one sentence of context, one primary CTA, and one secondary learning link.

Auth and welcome pages use the onboarding split shell as a full-viewport layout, not a centered card. Content stays on the left and the design space stays on the right for both `/login` and `/welcome`. Do not switch sides between routes; keep the experience calm and spatially predictable.

The auth shell is fixed to the viewport height and must not create page scroll. `/login` and `/welcome` live under the same auth route-group layout so the FeedMe brand mark, right-side design space, and shell structure are owned once. Page files only provide the middle content. Form headings use the shared `AuthHeading` treatment with centered alignment across login and welcome, so route changes feel like content changes inside one stable layout. Animated design spaces live under FeedMe experience components, not `components/ui`. They may use token-driven motion texture such as glossy candy-like full-height bars, subtle linear atmosphere, smooth arc fades, concise top-right product links, and a legible bottom-right text block, but they must keep the product palette, use the dark card surface, avoid one-off hard-coded colors, and stay minimal. Bars must not bounce, resize, or create a changing skyline; the columns should stay aligned while a shared shimmer/brightness pass and coordinated per-column glints move across the full panel so the material feels connected and alive. Motion should reverse or alternate cleanly so the loop never visibly snaps back to the start. The top fade should hide roughly the upper third of the bars softly in an arc with no obvious edge; the right fade should lightly connect that arc into the bottom-right; the bottom fade can span the lower edge but must stay bottom-right weighted, feathering modestly into the lower center without becoming the dominant bottom-center shape. The combined fade should feel like one soft perimeter shape that collapses before reaching the left content area. The design space should be inset with breathing room and rounded edges instead of touching the viewport edges. Do not add fake preview cards, visible grid lines, circular decorative gradients, or dashboard mock content inside the design space.

Report pages should prioritize screenshot evidence, issue title, severity, status, assignee, domain, browser/device metadata, comments, and next steps. Team pages should prioritize members, roles, presence, workload, invite status, and recent feedback activity. Operations pages should prioritize queue health, unresolved items, integrations, capture sources, and automation status.

Generated imagery inside the dashboard should look like product evidence: feedback widgets, browser captures, member collaboration, report triage, and operational queues. Avoid generic stock art, oversized hero illustrations, or purely atmospheric images.

Motion should be quick and tactile:

- Press: `transform: scale(0.97)`.
- Hover: 125-150ms ease-out for background, border, shadow, and transform.
- Entrances: spring-like `cubic-bezier(0.34, 1.56, 0.64, 1)` only for small floating UI.
- Toolbar and widget movement: `cubic-bezier(0.19, 1, 0.22, 1)`.

## Do's and Don'ts

Do:

- Keep the UI grey, charcoal, and premium. Let blue act as a precise signal.
- Use shadcn components and create FeedMe variants instead of one-off component styling.
- Keep files modular: layout shells, navigation, top bar, report surfaces, team surfaces, forms, and tokens should live in clean separate modules.
- Prefer dense but readable SaaS screens over marketing-style sections.
- Use clear visual hierarchy: one primary action per view, supporting actions nearby, metadata muted.
- Preserve negative space in onboarding and empty states.
- Use tactile buttons with inset highlights and small press interactions.
- Use pointer cursors on clickable buttons, icon buttons, upload targets, nav rows, menu items, and command controls.
- Make every icon-only button discoverable with a tooltip.
- Keep screenshots, report previews, and member/activity surfaces concrete and product-relevant.

Don't:

- Do not make the app blue-black, purple, beige, or gradient-heavy.
- Do not flood dashboards with metrics before the user has enough data.
- Do not use large rounded marketing cards for every section.
- Do not put cards inside cards unless it is a dialog, repeated record, or actual framed tool.
- Do not use Caveat for normal UI text.
- Do not use visible instructional text to explain obvious controls.
- Do not create decorative orbs, bokeh blobs, or abstract gradient backgrounds.
- Do not copy Inflight branding, logos, names, or exact content. Replicate the principle: dark layered tactile SaaS, not the brand.

## Implementation Contract

The token chain for FeedMe is:

```txt
design.md -> src/app/globals.css -> shadcn/Tailwind utilities -> components and pages
```

`design.md` owns design decisions. `globals.css` mirrors those decisions as runtime CSS variables and Tailwind theme utilities. Components should consume the mirrored tokens; they should not create a competing design system.

When building pages or shared components:

- Use shadcn components first, then create FeedMe-specific variants around them.
- Use semantic utilities for ordinary UI: `bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`, `bg-primary`, `text-primary-foreground`, `bg-sidebar`, and `bg-sidebar-accent`.
- Use FeedMe primitive utilities when the design needs exact surfaces: `bg-surface-shell`, `bg-surface-panel`, `bg-surface-page`, `bg-surface-sunken`, `bg-surface-card`, `bg-surface-raised`, `text-text-body`, `text-text-muted`, `border-border-hairline`, `shadow-button`, `shadow-card`, `shadow-popover`, `w-sidebar`, `h-topbar`, and `w-right-rail`.
- Use CSS variables for complex token values that do not map cleanly to a normal utility, such as `var(--gradient-primary)`, `var(--fill-nav-active)`, or `var(--press-scale)`.
- If a new visual decision is needed, add or update the token here first, mirror it in `globals.css`, then use it in components.

Do not hard-code color hex values, raw `rgba(...)` colors, custom border colors, one-off shadows, arbitrary radii, or ad hoc font sizes inside components. The only exceptions are external media, user-uploaded images, screenshots, avatars, third-party brand marks, and data visualizations that intentionally use the semantic chart/status tokens.
