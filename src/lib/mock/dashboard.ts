export type WorkspaceStat = {
  label: string
  value: string
}

export type MockWorkspace = {
  slug: string
  name: string
  user: {
    displayName: string
    title: string
    initials: string
  }
  stats: WorkspaceStat[]
  trial: {
    daysLeft: number
    seatsUsed: number
    seatsTotal: number
  }
}

export type MockReportSummary = {
  id: string
  title: string
  summary: string
  severity: "low" | "medium" | "high" | "urgent"
  status: "open" | "triaged" | "in_progress" | "resolved"
  type: "bug" | "ux" | "copy" | "performance" | "accessibility"
  domain: string
  url: string
  browser: string
  device: string
  viewport: string
  capturedAt: string
  capturedAgo: string
  screenshots: {
    id: string
    label: string
    kind: "page" | "annotated"
  }[]
  selectedElement: {
    tag: string
    selector: string
    text?: string
    attributes: Record<string, string>
  }
  feedback: {
    message: string
    reporterName: string
    reporterEmail: string
  }
  developerPrompt: string
  assignee?: {
    name: string
    initials: string
  }
  commentsCount: number
}

export const reservedWorkspaceSlugs = [
  "admin",
  "api",
  "domains",
  "extension",
  "help",
  "login",
  "reports",
  "settings",
  "team",
  "welcome",
]

function titleFromSlug(slug: string) {
  const base = slug
    .replace(/-\d+$/, "")
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")

  return base || "FeedMe"
}

export function getMockWorkspace(slug: string): MockWorkspace {
  return {
    slug,
    name: titleFromSlug(slug),
    user: {
      displayName: "Almostdev",
      title: "Product Lead",
      initials: "A",
    },
    stats: [
      { label: "Reports", value: "8" },
      { label: "Domains", value: "3" },
      { label: "Members", value: "4" },
    ],
    trial: {
      daysLeft: 30,
      seatsUsed: 2,
      seatsTotal: 3,
    },
  }
}

const mockReports: MockReportSummary[] = [
  {
    id: "checkout-cta-overlap",
    title: "Checkout CTA overlaps the coupon field on tablet",
    summary:
      "The primary checkout button sits over the coupon input around tablet width, making the coupon field feel broken.",
    severity: "urgent",
    status: "open",
    type: "bug",
    domain: "checkout.feedme.test",
    url: "https://checkout.feedme.test/cart",
    browser: "Chrome 126",
    device: "iPad Air",
    viewport: "820 x 1180",
    capturedAt: "Jun 28, 2026, 10:42 AM",
    capturedAgo: "18m ago",
    screenshots: [
      { id: "checkout-page", label: "Page", kind: "page" },
      { id: "checkout-annotated", label: "Annotated", kind: "annotated" },
    ],
    selectedElement: {
      tag: "button",
      selector: "form.checkout button[type='submit']",
      text: "Pay now",
      attributes: {
        "data-testid": "checkout-submit",
        class: "checkout-submit primary",
      },
    },
    feedback: {
      message:
        "The Pay now button overlaps the coupon field. I cannot tell if the coupon was applied before submitting payment.",
      reporterName: "Maya Chen",
      reporterEmail: "maya@acme.test",
    },
    developerPrompt:
      "Investigate the checkout layout at https://checkout.feedme.test/cart around viewport 820 x 1180. The selected element is form.checkout button[type='submit'] with text 'Pay now'. User feedback: The Pay now button overlaps the coupon field, so the user cannot tell whether the coupon was applied before submitting payment. Implement the smallest safe layout fix and preserve the primary CTA hierarchy.",
    assignee: {
      name: "Ayush",
      initials: "A",
    },
    commentsCount: 3,
  },
  {
    id: "pricing-card-copy",
    title: "Pricing card promise is unclear for starter plan",
    summary:
      "The starter plan says unlimited reports but the comparison table below mentions monthly limits.",
    severity: "medium",
    status: "triaged",
    type: "copy",
    domain: "feedme.test",
    url: "https://feedme.test/pricing",
    browser: "Arc 1.52",
    device: "MacBook Pro",
    viewport: "1440 x 900",
    capturedAt: "Jun 28, 2026, 9:58 AM",
    capturedAgo: "1h ago",
    screenshots: [
      { id: "pricing-page", label: "Page", kind: "page" },
      { id: "pricing-annotated", label: "Annotated", kind: "annotated" },
    ],
    selectedElement: {
      tag: "p",
      selector: "[data-plan='starter'] .plan-limit-copy",
      text: "Unlimited feedback reports",
      attributes: {
        "data-plan": "starter",
      },
    },
    feedback: {
      message:
        "Starter says unlimited reports here, but the table says 100 reports per month. Which one is true?",
      reporterName: "Nolan Reyes",
      reporterEmail: "nolan@acme.test",
    },
    developerPrompt:
      "Review the starter plan copy on https://feedme.test/pricing. Selected element: [data-plan='starter'] .plan-limit-copy. Current text: 'Unlimited feedback reports'. User feedback says this conflicts with the comparison table showing 100 reports per month. Align the card copy with the actual plan limit and keep the pricing hierarchy intact.",
    assignee: {
      name: "Priya",
      initials: "P",
    },
    commentsCount: 1,
  },
  {
    id: "dashboard-search-focus",
    title: "Dashboard search focus has no visible neutral state",
    summary:
      "The search input focus is too subtle, so keyboard users cannot tell where focus landed.",
    severity: "high",
    status: "in_progress",
    type: "accessibility",
    domain: "app.feedme.test",
    url: "https://app.feedme.test/bump/reports",
    browser: "Firefox 127",
    device: "Windows laptop",
    viewport: "1366 x 768",
    capturedAt: "Jun 28, 2026, 9:17 AM",
    capturedAgo: "2h ago",
    screenshots: [
      { id: "search-page", label: "Page", kind: "page" },
      { id: "search-annotated", label: "Annotated", kind: "annotated" },
    ],
    selectedElement: {
      tag: "input",
      selector: "header input[aria-label='Search reports, domains, people']",
      attributes: {
        "aria-label": "Search reports, domains, people",
      },
    },
    feedback: {
      message:
        "When I tab into search, I cannot visually confirm focus unless I start typing.",
      reporterName: "Ari Gupta",
      reporterEmail: "ari@acme.test",
    },
    developerPrompt:
      "Improve keyboard focus visibility for header input[aria-label='Search reports, domains, people'] on https://app.feedme.test/bump/reports. Feedback: focus is not visible until typing starts. Keep FeedMe's design rule: no blue ring or glow, only a stronger neutral hairline border/fill state.",
    assignee: {
      name: "Sam",
      initials: "S",
    },
    commentsCount: 5,
  },
  {
    id: "onboarding-upload-empty",
    title: "Workspace logo upload looks disabled",
    summary:
      "The upload target appears inactive because the contrast is too low beside the workspace name field.",
    severity: "low",
    status: "open",
    type: "ux",
    domain: "app.feedme.test",
    url: "https://app.feedme.test/welcome",
    browser: "Safari 18",
    device: "iPhone 15",
    viewport: "393 x 852",
    capturedAt: "Jun 28, 2026, 8:49 AM",
    capturedAgo: "2h ago",
    screenshots: [
      { id: "upload-page", label: "Page", kind: "page" },
      { id: "upload-annotated", label: "Annotated", kind: "annotated" },
    ],
    selectedElement: {
      tag: "label",
      selector: "label[for='workspace-logo']",
      text: "Upload logo",
      attributes: {
        for: "workspace-logo",
      },
    },
    feedback: {
      message:
        "The logo upload row looks disabled. I hesitated because I was not sure if it could be clicked.",
      reporterName: "Elena Park",
      reporterEmail: "elena@acme.test",
    },
    developerPrompt:
      "Review the workspace logo upload target at https://app.feedme.test/welcome. Selected element: label[for='workspace-logo'] with text 'Upload logo'. Feedback says it looks disabled because contrast is too low. Increase affordance using neutral border/fill tokens while preserving the compact onboarding layout.",
    commentsCount: 0,
  },
  {
    id: "mobile-nav-active-state",
    title: "Mobile nav active state is hard to distinguish",
    summary:
      "The active Reports item on mobile looks too close to the inactive items when the sheet is opened.",
    severity: "medium",
    status: "triaged",
    type: "ux",
    domain: "m.feedme.test",
    url: "https://m.feedme.test/menu",
    browser: "Chrome 126",
    device: "Pixel 8",
    viewport: "412 x 915",
    capturedAt: "Jun 28, 2026, 8:21 AM",
    capturedAgo: "3h ago",
    screenshots: [
      { id: "mobile-nav-page", label: "Page", kind: "page" },
      { id: "mobile-nav-annotated", label: "Annotated", kind: "annotated" },
    ],
    selectedElement: {
      tag: "a",
      selector: "nav a[href='/bump/reports']",
      text: "Reports",
      attributes: {
        href: "/bump/reports",
        "aria-current": "page",
      },
    },
    feedback: {
      message:
        "When the mobile menu opens, I cannot immediately tell which section I am currently in.",
      reporterName: "Ishaan Mehta",
      reporterEmail: "ishaan@acme.test",
    },
    developerPrompt:
      "Review the mobile navigation sheet on https://m.feedme.test/menu. Selected element: nav a[href='/bump/reports'] with text 'Reports'. Feedback says the active state is too close to inactive items. Strengthen the active nav surface using existing FeedMe sidebar active tokens without introducing new blue-heavy styling.",
    assignee: {
      name: "Maya",
      initials: "M",
    },
    commentsCount: 2,
  },
  {
    id: "delete-project-warning",
    title: "Delete project dialog needs stronger warning hierarchy",
    summary:
      "The destructive dialog makes the cancel and delete choices feel too visually similar.",
    severity: "high",
    status: "open",
    type: "ux",
    domain: "app.feedme.test",
    url: "https://app.feedme.test/bump/projects",
    browser: "Arc 1.52",
    device: "MacBook Air",
    viewport: "1280 x 832",
    capturedAt: "Jun 28, 2026, 7:44 AM",
    capturedAgo: "4h ago",
    screenshots: [
      { id: "delete-dialog-page", label: "Page", kind: "page" },
      { id: "delete-dialog-annotated", label: "Annotated", kind: "annotated" },
    ],
    selectedElement: {
      tag: "button",
      selector: "button[data-action='delete-project']",
      text: "Delete",
      attributes: {
        "data-action": "delete-project",
      },
    },
    feedback: {
      message:
        "The delete action is scary, but the dialog does not make the destructive choice clear enough.",
      reporterName: "Priya S.",
      reporterEmail: "priya@acme.test",
    },
    developerPrompt:
      "Improve the destructive dialog hierarchy on https://app.feedme.test/bump/projects. Selected element: button[data-action='delete-project'] with text 'Delete'. Feedback says cancel and delete feel visually similar. Preserve FeedMe's dark modal language while making the destructive path unmistakable.",
    assignee: {
      name: "Priya",
      initials: "P",
    },
    commentsCount: 4,
  },
  {
    id: "domain-filter-empty-copy",
    title: "Domain filter empty result copy feels final",
    summary:
      "The empty copy after filtering domains sounds like the domain has no reports at all.",
    severity: "low",
    status: "resolved",
    type: "copy",
    domain: "admin.feedme.test",
    url: "https://admin.feedme.test/domains",
    browser: "Safari 18",
    device: "iPad Pro",
    viewport: "1024 x 1366",
    capturedAt: "Jun 28, 2026, 7:05 AM",
    capturedAgo: "5h ago",
    screenshots: [
      { id: "domain-filter-page", label: "Page", kind: "page" },
      { id: "domain-filter-annotated", label: "Annotated", kind: "annotated" },
    ],
    selectedElement: {
      tag: "p",
      selector: "[data-empty-state='domain-filter'] p",
      text: "No reports found",
      attributes: {
        "data-empty-state": "domain-filter",
      },
    },
    feedback: {
      message:
        "This says no reports found, but I only filtered to resolved. It made me think the whole domain was empty.",
      reporterName: "Nolan Reyes",
      reporterEmail: "nolan@acme.test",
    },
    developerPrompt:
      "Review the domain filter empty state on https://admin.feedme.test/domains. Selected element: [data-empty-state='domain-filter'] p with text 'No reports found'. Feedback says the copy feels final even when a filter is active. Adjust copy to clarify that the current filter returned no matches.",
    assignee: {
      name: "Sam",
      initials: "S",
    },
    commentsCount: 1,
  },
  {
    id: "team-invite-role-dropdown",
    title: "Team invite role dropdown hides selected access",
    summary:
      "The invite form shows the role menu too subtly, so admins miss which access level is being sent.",
    severity: "medium",
    status: "triaged",
    type: "accessibility",
    domain: "app.feedme.test",
    url: "https://app.feedme.test/bump/team",
    browser: "Firefox 127",
    device: "Windows laptop",
    viewport: "1440 x 900",
    capturedAt: "Jun 28, 2026, 6:38 AM",
    capturedAgo: "5h ago",
    screenshots: [
      { id: "team-invite-page", label: "Page", kind: "page" },
      { id: "team-invite-annotated", label: "Annotated", kind: "annotated" },
    ],
    selectedElement: {
      tag: "button",
      selector: "button[aria-label='Invite role']",
      text: "Member",
      attributes: {
        "aria-label": "Invite role",
      },
    },
    feedback: {
      message:
        "I sent an invite and only later realized the role was Member. The dropdown did not feel important enough.",
      reporterName: "Elena Park",
      reporterEmail: "elena@acme.test",
    },
    developerPrompt:
      "Review the team invite role control on https://app.feedme.test/bump/team. Selected element: button[aria-label='Invite role'] with text 'Member'. Feedback says the role selection is too easy to miss. Improve affordance using neutral tactile button styling and keep the invite form compact.",
    commentsCount: 2,
  },
]

export function getMockReports(workspaceSlug: string): MockReportSummary[] {
  void workspaceSlug

  return mockReports
}

export function getMockReport(
  workspaceSlug: string,
  reportId: string
): MockReportSummary | undefined {
  void workspaceSlug

  return mockReports.find((report) => report.id === reportId)
}
