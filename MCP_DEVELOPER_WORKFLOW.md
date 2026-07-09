# FeedMe MCP Developer Workflow

This file defines how FeedMe should make assigned work easier for developers,
designers, and coding agents. It extends `integration.md`,
`API_IMPLEMENTATION_GUIDE.md`, `DASHBOARD.md`, and
`PROJECT_VISION.md`.

The goal is not just to expose reports over MCP. The goal is to turn every
assigned report into a developer-ready mission with screenshots, acceptance
criteria, implementation context, workflow actions, and useful agent presets.

## Product Principle

FeedMe reports can be submitted by anyone in the workspace, but implementation
context is owned by the people responsible for triage.

Reporter input answers:

```txt
what looked wrong
where it happened
what the user expected
```

Admin/owner context answers:

```txt
what must be true before this is done
what the assignee should know
what should not be changed
how reviewers should verify the fix
```

Developer notes answer:

```txt
what the assignee discovered
what they changed
what is blocked
what reviewers should pay attention to
```

These three layers should stay separate in the data model, UI, and MCP output.

## Report Handoff Fields

Each report can have an optional implementation handoff edited by owners/admins.

Fields:

```txt
acceptanceCriteria
implementationNotes
constraintsNonGoals
expectedBehavior
referenceLinks
reviewChecklist
```

All fields are optional. Empty fields should not add visual noise in the report
rail, detail page, or MCP output.

Recommended data shape:

```ts
type ReportImplementationBrief = {
  acceptanceCriteria?: string[]
  implementationNotes?: string
  constraintsNonGoals?: string[]
  expectedBehavior?: string
  referenceLinks?: Array<{
    label?: string
    url: string
  }>
  reviewChecklist?: string[]
  updatedAt?: string
  updatedBy?: {
    id: string
    name: string
    email: string
  }
}
```

Recommended storage:

```txt
report_implementation_briefs
-> id
-> workspaceId
-> reportId
-> acceptanceCriteria jsonb
-> implementationNotes text
-> constraintsNonGoals jsonb
-> expectedBehavior text
-> referenceLinks jsonb
-> reviewChecklist jsonb
-> updatedByUserId
-> createdAt
-> updatedAt
```

Why a separate table:

```txt
keeps reports table focused on captured feedback
lets us add structured handoff fields without bloating list queries
can be fetched with report detail and MCP get_report
supports future audit/version history if needed
```

Rules:

```txt
owners/admins can create and edit the implementation brief
developers/designers can read the brief on assigned reports
reporters can read only if they already have report detail access
brief edits should not change report status automatically
MCP get_report and context-pack tools must include these fields
search should eventually include brief text
```

## Report Detail Tabs

The report detail page owns deep report work. The right rail stays focused on
quick inspection and workflow actions.

Tabs:

```txt
Evidence
Activity / Notes
Comments
Implementation brief
```

Visibility:

```txt
Evidence
  visible to everyone with report detail access

Activity / Notes
  visible to everyone with report detail access

Comments
  visible to everyone with report detail access

Implementation brief
  visible only to owners/admins
```

Behavior:

```txt
Evidence shows screenshots, reporter feedback, selected element, metadata, and developer prompt
Activity / Notes owns status events and workflow notes, not discussion comments or duplicate report metadata
Comments owns the threaded workspace discussion around the report
Implementation brief contains the editable owner/admin handoff fields
```

Implementation brief UI rules:

```txt
do not render all fields as plain textareas
visible dashboard fields are expected behavior, review checklist, implementation plan, and reference links
expected behavior and implementation plan are textareas
review checklist is an editable list
reference links are structured label + URL rows
acceptance criteria and constraints/non-goals stay in the schema/API/MCP contract but are hidden in the dashboard UI for now
empty fields should stay quiet and not add visual bulk
```

The report row context menu should deep-link owners/admins directly to:

```txt
/:workspaceSlug/reports/:reportId?tab=brief
```

## Developer Work Notes

Developers/designers must be able to add notes while working.

Developer notes are not the same thing as acceptance criteria. They should be
append-only activity items, not a mutable admin brief.

Recommended data shape:

```ts
type ReportWorkNote = {
  id: string
  author: {
    id: string
    name: string
    email: string
  }
  kind: "work_note" | "blocker" | "clarification" | "review_note"
  body: string
  createdAt: string
}
```

Implemented storage:

```txt
use report_notes for workflow activity:
work_note | blocker | clarification | review_note

use report_comments for threaded discussion:
body, parentCommentId, author, createdAt, editedAt, deletedAt, replyCount

use report_comment_reactions for clean product reactions:
seen | agree | blocked | helpful

use report_comment_mentions for durable exact mentions:
commentId, mentionedUserId, createdByUserId

use notifications for in-app workflow awareness:
report_assigned | comment_reply | comment_mention | admin_comment_added | clarification_added | blocker_added | ready_for_review | report_resolved
```

Rules:

```txt
assigned developer/designer can add work_note and blocker notes
owners/admins can add clarification and review notes
all commenting roles can add threaded comments in the Comments tab
comments can be replied to at any depth
report detail loads top-level comments first; replies are lazy-loaded per parent
reply UI uses connector lines instead of nested cards
authors can edit their own non-deleted comments
authors, owners, and admins can soft-delete comments
deleted parent comments with replies remain as a quiet deleted placeholder
reaction UI uses restrained product chips, not emoji-heavy reactions
mentions are stored as user ids, not inferred from display text
comment composer autocomplete writes mentionedUserIds into comment mutations
comment payloads include hydrated mention actors for exact mention rendering
clicking a rendered mention opens a lightweight teammate profile dialog
in-app notifications are emitted by server mutation services
notes appear in report detail Activity / Notes
right rail can show the latest note count/preview later
MCP get_report includes recent notes
MCP add_work_note creates a work_note
MCP mark_ready_for_review accepts a final note
MCP mark_blocked creates a blocker note without inventing a blocked status yet
```

Comment maturity backlog:

```txt
notifications
  add email/push delivery later
  add websocket/live delivery later
  keep in-app notification table as source of truth
```

## Dashboard Context Menu

FeedMe should use the existing shadcn/Base UI context menu component for report
row actions. The component already exists at:

```txt
src/components/ui/context-menu.tsx
```

The shadcn docs define context menu as a menu of actions triggered by right
click, with `ContextMenu`, `ContextMenuTrigger`, and `ContextMenuContent`.
Use it for table/list rows and keep the normal left-click behavior for row
selection.

Source:

```txt
https://ui.shadcn.com/docs/components/base/context-menu
```

Report row context menu actions:

```txt
Open in agent
Copy MCP command
Copy fix prompt
Start work
Ready for review
```

Recommended grouping:

```txt
Agent
-> Open in agent
-> Copy MCP command
-> Copy fix prompt

Workflow
-> Start work
-> Ready for review
```

Visibility rules:

```txt
Open in agent
  visible for signed-in workspace members with report detail access

Copy MCP command
  visible for signed-in workspace members with report detail access

Copy fix prompt
  visible for signed-in workspace members with report detail access

Start work
  enabled only when report is assigned to current developer/designer and status is assigned

Ready for review
  enabled only when report is assigned to current developer/designer and status is in_progress
```

The context menu is an accelerator, not the only path. All critical actions
must still exist in the right rail/detail workflow controls for discoverability
and touch devices.

Implementation status:

```txt
implemented on Reports and My Work table rows
implemented on Reports and My Work grid cards
right-clicking a report opens FeedMe actions instead of the browser context menu
```

Current actions:

```txt
Open in agent
Copy MCP command
Copy fix prompt
Open report
Implementation brief, owner/admin only
Open captured page
Start work, assigned developer/designer only
Ready for review, assigned developer/designer only
```

## Agent Commands And Prompts

Copy MCP command should produce a short, direct command the developer can paste
into their coding agent.

Example:

```txt
Use FeedMe MCP. Get report {reportId}, inspect the screenshots and acceptance
criteria, identify the likely files, implement the smallest production-safe fix,
run relevant checks, and mark the report ready for review with a concise summary.
```

Copy fix prompt should produce a richer one-off prompt for users who have not
connected MCP yet.

Example:

```txt
Fix this FeedMe report:

Report: {title}
URL: {url}
Selected element: {selector}
Feedback: {feedbackMessage}
Acceptance criteria:
- ...

Use the screenshots and report context in FeedMe. Keep the fix scoped and
production-ready. Summarize changed files and verification.
```

Open in agent is future-facing. Until there is a reliable deep-link protocol
for each supported agent, it can open the Connect coding agent dialog or copy a
command and show a success toast.

## MCP Tool Roadmap

Current v1 tools:

```txt
whoami()
list_my_reports(status?, limit?)
get_report(reportId)
start_work(reportId)
mark_ready_for_review(reportId, note?)
add_work_note(reportId, note)
mark_blocked(reportId, reason)
```

Next tools:

```txt
get_next_report()
get_report_context_pack(reportId)
ask_for_clarification(reportId, question)
```

Later tools:

```txt
attach_branch(reportId, branchName)
attach_pull_request(reportId, prUrl)
verify_report_ready(reportId)
list_workspace_repos()
link_report_to_repo(reportId, repoId)
```

Rules:

```txt
all MCP tools reuse existing report services where possible
all MCP tools resolve PAT -> user -> live active workspace membership on every request
developers/designers can only mutate reports assigned to them
owners/admins can get future admin tools, but not in the first developer workflow pass
tool responses should be concise but include the report id and next suggested action
```

## MCP Presets

Presets should be implemented as MCP prompts. They are user-invoked workflows,
not hidden model behavior.

Presets:

```txt
quick_fix
  Smallest safe code change. Avoid broad refactors. Run focused checks.

analyze_no_code
  Investigate root cause and produce an implementation plan. Do not edit files.

fix_report
  Full assigned-report workflow: get report, inspect evidence, implement, verify,
  and mark ready for review when appropriate.

ui_polish
  Use screenshots, selected element, and FeedMe design system context to improve
  visual quality without changing unrelated behavior.

write_tests
  Add or update regression coverage for the report.

verify_fix
  Check whether the current code/change satisfies the acceptance criteria.

prepare_pr_summary
  Generate a PR title/body from the report, changed files, and verification.

ask_clarifying_question
  Draft one clear question for admin/reporter when the report is ambiguous.
```

Recommended prompt inputs:

```txt
reportId optional for presets that can use get_next_report
strictness: quick | normal | deep
allowCodeChanges: boolean
runChecks: boolean
```

## MCP Report Context Pack

`get_report` should remain useful, but `get_report_context_pack` should become
the canonical agent handoff.

Context pack sections:

```txt
identity
  report id, workspace slug, title, severity, status

problem
  reporter feedback, summary, expected behavior

implementation brief
  acceptance criteria, implementation notes, constraints/non-goals,
  reference links, review checklist

evidence
  page screenshot, element/annotated screenshot, URL, viewport, browser/device

target
  selected element selector, tag, text, attributes

activity
  assignee, latest work notes, blockers, status history

definition of done
  generated checklist combining FeedMe defaults and admin review checklist

next actions
  start work, add note, mark blocked, mark ready for review
```

Definition of done defaults:

```txt
reported issue is fixed on the captured viewport
selected element no longer shows the described problem
acceptance criteria are satisfied
no unrelated UI or behavior changes
relevant checks/tests were run or clearly skipped with a reason
ready-for-review note explains what changed
```

## Implementation Slices

Slice A: Documentation and contracts.

```txt
add this file
link it from API_IMPLEMENTATION_GUIDE.md and DASHBOARD.md
confirm schema/API/UI approach before migration
```

Slice B: Report implementation brief.

```txt
add schema table
add validation
add service read/write methods
add owner/admin API route
include brief in report detail contract
add admin-only Implementation brief tab on report detail
include brief in MCP get_report
```

Slice C: Work notes.

```txt
add report_notes table for workflow notes
keep report_comments as threaded discussion
add create note API
add dashboard note action/dialog for assignees and admins
add Comments tab with comment/reply composer
add MCP add_work_note and mark_blocked
include recent notes in report detail and MCP context pack
status: implemented
```

Slice D: Context menu.

```txt
wrap report table rows with ContextMenu
add grouped agent/workflow actions
copy command/prompt to clipboard
wire Start work and Ready for review to existing optimistic mutations
keep row left-click selection unchanged
```

Slice E: MCP prompts.

```txt
register quick_fix, analyze_no_code, fix_report, ui_polish, write_tests,
verify_fix, prepare_pr_summary, ask_clarifying_question
```

## Non-Goals For This Slice

```txt
GitHub installation
automatic PR creation
agent-specific deep links
full realtime collaboration
AI-generated acceptance criteria
billing or permission packages
```
