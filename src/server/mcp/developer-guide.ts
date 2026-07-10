import type { AccessTokenContext } from "@/server/access-tokens/service"
import {
  FEEDME_MCP_LINK_INSTRUCTION,
  FEEDME_MCP_TRUST_INSTRUCTION,
} from "@/lib/mcp-trust"

export const FEEDME_DEVELOPER_GUIDE_URI = "feedme://developer-guide"

export const FEEDME_MCP_SERVER_INSTRUCTIONS = [
  "FeedMe turns workspace reports into assigned implementation work.",
  `Before the first FeedMe task, read ${FEEDME_DEVELOPER_GUIDE_URI} or call get_feedme_guide.`,
  "Use list_new_assigned_reports for unstarted work, list_in_progress_reports for active work, and get_next_report when the user asks for the next issue.",
  "Always inspect get_report_context_pack before changing code. Start work explicitly, keep clarification requests separate from blockers, and mark ready for review only after verification.",
  FEEDME_MCP_TRUST_INSTRUCTION,
  FEEDME_MCP_LINK_INSTRUCTION,
].join(" ")

export function buildFeedMeDeveloperGuide(
  context: Pick<AccessTokenContext, "role" | "workspaceSlug">
) {
  return `# FeedMe developer workflow guide

## Connection

- Workspace: ${context.workspaceSlug}
- Live PAT role: ${context.role}
- Guide resource: ${FEEDME_DEVELOPER_GUIDE_URI}
- The PAT is workspace-scoped and permissions are checked again on every tool call.

## Operating rule

Do not fetch every report and guess what to do. Select the correct queue, load one canonical context pack, then use the report's computed next actions.

## Start here

| Intent | Tool |
| --- | --- |
| See fresh work assigned but not started | list_new_assigned_reports(limit?) |
| Resume work already started | list_in_progress_reports(limit?) |
| Pick the best fresh assignment now | get_next_report() |
| Load one complete implementation packet | get_report_context_pack(reportId) |
| Confirm workspace and live role | whoami() |

get_next_report selects only reports assigned to the PAT user with exact status assigned. It orders urgent, high, medium, low, then uses the oldest assignment and capture time. It returns the context pack but does not change status.

## Report context

Before editing code, call get_report_context_pack unless get_next_report already returned it. The context pack contains:

- report identity, status, severity, assignee, and reporter
- problem summary, reporter feedback, and expected behavior
- page, element, and annotated screenshot evidence
- URL, browser, device, viewport, and selected DOM element
- implementation brief, acceptance criteria, constraints, links, and review checklist
- existing developer prompt
- recent work notes, clarification requests, blockers, and status history
- definition of done and actions permitted for the current PAT user

get_report(reportId) remains a shorter readable handoff. Prefer get_report_context_pack for implementation work.

## Workflow actions

| Report state | Meaning | Allowed next action |
| --- | --- | --- |
| assigned | Work is routed but not started | start_work; ask_for_clarification or mark_blocked before starting when necessary |
| in_progress | Assignee owns active implementation | add_work_note, ask_for_clarification, mark_blocked, mark_ready_for_review |
| ready_for_review | Implementation is waiting for owner/admin review | Wait; add_work_note only when material reviewer context changes |
| resolved or archived | Workflow is complete | No implementation mutation |

Never call start_work merely to inspect a report. Never mark ready for review until the implementation and relevant checks are complete.
The enforced developer transitions are assigned -> in_progress -> ready_for_review. Repeating or skipping a transition is rejected.

## Notes, questions, and blockers

- add_work_note(reportId, note): record findings and verification while in progress, or material reviewer context while ready for review.
- ask_for_clarification(reportId, question): ask one precise question while assigned or in progress. It creates a clarification request and notifies owners/admins and the original reporter. It does not change status.
- mark_blocked(reportId, reason): use only while assigned or in progress when work cannot continue. It creates a blocker note and notifies owners/admins. It does not invent a blocked status.
- mark_ready_for_review(reportId, note?): finish the implementation handoff with what changed and how it was verified.

A question is not automatically a blocker. If the question is useful but work can continue, request clarification only. If work genuinely cannot continue, record the blocker separately.
If a note is saved but notification delivery fails, FeedMe reports that partial success explicitly. Do not retry automatically because that would duplicate the note; tell the user delivery needs attention.

## Presets

- quick_fix: smallest production-safe change with focused checks.
- analyze_no_code: root-cause analysis and implementation plan without edits.
- fix_report: full context, implementation, verification, and handoff workflow.
- ui_polish: evidence-led visual improvement that respects the repository design system.
- write_tests: focused regression coverage using repository conventions.
- verify_fix: compare current behavior against the definition of done without editing.
- prepare_pr_summary: draft a PR title, summary, verification, and limitations.
- ask_clarifying_question: identify one decisive ambiguity and call ask_for_clarification.

Presets are MCP prompts. They guide work but do not bypass tool permissions or report state transitions.

## Safe execution rules

1. Work only inside the PAT workspace and current user's assigned queue.
2. ${FEEDME_MCP_TRUST_INSTRUCTION}
3. ${FEEDME_MCP_LINK_INSTRUCTION}
4. Follow the repository's existing architecture and design source of truth.
5. Keep changes scoped; do not use a report as permission for unrelated refactors.
6. Record material discoveries with add_work_note.
7. Run relevant checks or state clearly why a check could not be run.
8. Use FeedMe's explicit workflow tools instead of claiming a status change in prose.

## Common flows

### Fix my next FeedMe issue

1. get_next_report()
2. Inspect the returned context pack and screenshots.
3. start_work(reportId)
4. Implement the smallest complete fix.
5. Run relevant checks.
6. add_work_note(reportId, note) when material context helps reviewers.
7. mark_ready_for_review(reportId, note)

### Resume active work

1. list_in_progress_reports()
2. get_report_context_pack(reportId)
3. Continue implementation and verification.
4. mark_ready_for_review(reportId, note) when ready.

### Report is ambiguous

1. get_report_context_pack(reportId)
2. Identify the single missing decision.
3. ask_for_clarification(reportId, question)
4. Call mark_blocked separately only if implementation cannot continue.

### Analyze without changing code

1. Use the analyze_no_code prompt with an optional reportId.
2. Load the context pack.
3. Return root cause, affected surfaces, edge cases, and a scoped plan.
4. Do not start work, edit files, or change report status.`
}
