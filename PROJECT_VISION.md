# FeedMe Project Vision

FeedMe is a visual feedback operating system for product teams.

A company creates a workspace, connects its websites, invites teammates, and every visual bug, UX issue, design note, or product comment flows from the live website into a structured dashboard where admins, designers, testers, and developers can act on it.

## Core Vision

A user signs up, creates an organization or workspace, adds the website where FeedMe should work, invites teammates, and assigns roles.

Only approved workspace members can use the extension for that workspace. Inside the extension, the user selects the active workspace, visits an approved domain, captures feedback, and that feedback appears inside the workspace dashboard.

The dashboard becomes the command center:

- Reports come in.
- Admins triage them.
- Admins assign them to developers or designers.
- Developers work through their assigned queue.
- Developers mark items done.
- Admins, designers, or QA review and resolve them.

## Main Roles

- Owner: creates workspace, manages billing, domains, members, and permissions.
- Admin/Product Lead: reviews all reports, changes status, assigns work, and manages workflow.
- Tester/Reporter: uses the extension to submit feedback and can view status of their own reports.
- Developer: sees assigned reports, copies developer handoff prompt, and marks work done.
- Designer/QA: reviews visual issues, comments, validates fixes, and reopens if needed.

## Production Setup Flow

1. User lands on FeedMe and signs up.
2. User completes profile: name, email, avatar, and display identity.
3. User creates workspace: company name, workspace name, and logo.
4. User adds first website or domain where FeedMe should work.
5. FeedMe verifies the domain later via DNS, HTML file, or integration.
6. User installs the extension.
7. User invites teammates by email.
8. Teammates accept invite, create profile, and join workspace.
9. Owner or admin assigns roles.
10. Everyone sees only the workspaces they belong to.

## Extension Flow

The extension is workspace-aware, not global.

1. User opens extension popup.
2. User signs in.
3. Extension fetches all workspaces where the user is a member.
4. User selects active workspace.
5. Extension checks the current tab domain against that workspace's allowed domains.
6. If allowed, the FeedMe button appears.
7. If not allowed, the extension stays quiet.
8. User activates feedback mode.
9. User selects an element, writes feedback, and captures screenshots.
10. Report is submitted into the selected workspace.

This solves the trust problem: random people cannot submit into random workspaces, and users cannot accidentally send feedback to the wrong company.

## Dashboard Flow

Each workspace has its own dashboard.

- Overview: report counts, active issues, critical items, and resolved trend.
- Report queue: incoming feedback from testers and reporters.
- Report detail: selected element screenshot, full page screenshot, metadata, reporter note, URL, selector, and viewport.
- Assignment: admin assigns report to developer or designer.
- Developer queue: developer sees only assigned reports.
- Reporter view: reporter sees status of their submitted items.
- Team management: invite, remove, and role change.
- Domain settings: allowed websites for extension activation.

## Feedback Lifecycle

Internal lifecycle:

```txt
Submitted
-> Reviewing
-> Accepted / Needs Info / Duplicate / Rejected
-> Assigned
-> In Progress
-> Ready For Review
-> Resolved
-> Archived
```

Reporter-facing labels can stay simpler:

```txt
Submitted
Reviewing
In Progress
Resolved
```

Admins and developers get the deeper workflow. Reporters get clarity without operational noise.

## Product Mental Model

Everything belongs to a workspace.

```txt
User
-> Membership
-> Workspace
-> Allowed Domains
-> Reports
-> Assets
-> Assignments
-> Status Events
-> Comments
```

That model lets the product scale from one internal project to many companies.

## Important Production Rules

- A report must belong to a workspace.
- A workspace must own allowed domains.
- A user must be a member before submitting.
- A role decides what the user can see or change.
- Extension must always know the active workspace.
- Server must validate membership and domain, not just trust the extension.
- Dashboard must never show cross-workspace data.
- Domain activation should eventually require verification.

## Future Enterprise Shape

For enterprise usage, FeedMe can grow into:

- Multiple workspaces per organization.
- Multiple projects or products per workspace.
- Role-based access control.
- SSO/SAML.
- Audit logs.
- Slack, Jira, GitHub, and Linear integrations.
- AI summary and developer prompt generation.
- Release and fix verification workflow.
- Billing by workspace, seats, reports, or projects.

## One-Line Vision

FeedMe lets teams turn messy visual feedback from live websites into organized, assignable, developer-ready work inside a secure workspace.

That is the thing to protect: not just screenshots, not just comments, but a real team workflow from website pain to structured report to assigned fix to reviewed resolution.
