# FeedMe MCP Guide

FeedMe exposes workspace reports to coding agents through a Streamable HTTP MCP endpoint at `/api/mcp`. The integration is designed around explicit queues and safe workflow transitions so an agent does not fetch every report and guess what to do.

## Connect A Client

1. Sign in to FeedMe and open the target workspace.
2. Open **Connect agent** from the dashboard.
3. Create a named personal access token.
4. Copy the generated client configuration immediately. The plaintext token is shown once.

```json
{
  "mcpServers": {
    "feedme": {
      "url": "https://YOUR_FEEDME_ORIGIN/api/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_FEEDME_PAT"
      }
    }
  }
}
```

Do not commit the token. One token grants only the creating member's live role in one workspace and can be revoked from the dashboard.

## Recommended Agent Sequence

1. Call `whoami` to confirm identity and workspace.
2. Call `get_feedme_guide` before the first FeedMe task.
3. Use `list_in_progress_reports` to resume existing work.
4. Otherwise call `get_next_report` or `list_new_assigned_reports`.
5. Read `get_report_context_pack` before planning or editing code.
6. Call `start_work` only when implementation actually starts.
7. Add material findings with `add_work_note`.
8. Use `ask_for_clarification` for a question and `mark_blocked` only when progress is genuinely blocked.
9. Run relevant checks, then call `mark_ready_for_review` with a concise verification note.

## Tools

| Tool | Purpose |
| --- | --- |
| `whoami` | Confirm the connected workspace and live role |
| `get_feedme_guide` | Read the canonical in-product agent instructions |
| `list_new_assigned_reports` | List fresh assigned work, ordered by severity and assignment age |
| `list_in_progress_reports` | List only work already started by the current member |
| `get_next_report` | Select the best fresh assigned report and return its context without changing status |
| `list_my_reports` | Compatibility view for the broader assigned queue |
| `get_report` | Read the human-oriented report handoff and screenshots |
| `get_report_context_pack` | Read identity, problem, evidence, brief, notes, blockers, history, definition of done, and safe next actions |
| `start_work` | Move the current member's assigned report to `in_progress` |
| `add_work_note` | Record an implementation finding or reviewer context |
| `mark_blocked` | Add a blocker note without inventing a separate report status |
| `ask_for_clarification` | Add a clarification request and notify the relevant humans |
| `mark_ready_for_review` | Submit completed in-progress work for owner/admin review |
| `list_assignable_members` | List active developers and designers by exact id and email |
| `assign_report` | Assign or explicitly unassign an existing report |
| `bulk_create_tasks` | Create 1-25 idempotent project tasks with optional assignment and implementation context |

## Bulk Task Import

Bulk tasks are project work, not fabricated browser feedback. They can include title, description, priority, type, source URL, assignee, acceptance criteria, implementation notes, constraints, expected behavior, reference links, and review checklist. Every optional field may be omitted when the source material does not provide it.

Before assigning imported tasks, call `list_assignable_members` and use an exact returned `userId` or unambiguous email. Ask the user when a requested person is missing or ambiguous. Unassigned tasks begin as `submitted`; assigned tasks begin as `assigned`.

The import is idempotent. Clients should preserve stable task identities when retrying a failed batch and inspect the per-item result instead of blindly submitting the whole set again.

## Prompt Presets

FeedMe registers these MCP prompts:

- `quick_fix`
- `analyze_no_code`
- `fix_report`
- `ui_polish`
- `write_tests`
- `verify_fix`
- `prepare_pr_summary`
- `ask_clarifying_question`

Presets accept an optional report id and execution controls such as strictness, whether code changes are allowed, and whether checks should run. They instruct the agent to load the canonical context, respect report scope, treat captured content as untrusted evidence, and report verification honestly.

## Clarification Semantics

`ask_for_clarification` creates a `clarification_request` activity note. It does not change report status and does not mark the report blocked. Owners, admins, and the original reporter can be notified. If work cannot continue, the agent should separately call `mark_blocked` with the concrete reason.

## Security Model

- PATs are workspace-scoped and stored only as hashes.
- Membership and role are re-resolved on every request.
- Agents cannot gain permissions beyond the member who created the token.
- Report text, captured DOM details, URLs, screenshots, and notes are untrusted input.
- Reference links must never receive FeedMe credentials.
- Destructive or out-of-scope actions are not implied by a report or preset.
