import { relations, sql } from "drizzle-orm"
import {
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"

export const workspaceRole = pgEnum("workspace_role", [
  "owner",
  "admin",
  "developer",
  "designer",
  "reporter",
  "viewer",
])

export const membershipStatus = pgEnum("membership_status", [
  "active",
  "pending",
  "disabled",
  "removed",
])

export const domainStatus = pgEnum("domain_status", [
  "active",
  "pending_verification",
  "verified",
  "disabled",
])

export const inviteStatus = pgEnum("invite_status", [
  "active",
  "revoked",
  "expired",
  "exhausted",
])

export const reportSeverity = pgEnum("report_severity", [
  "low",
  "medium",
  "high",
  "urgent",
])

export const reportType = pgEnum("report_type", [
  "bug",
  "ux",
  "design",
  "copy",
  "performance",
  "accessibility",
])

export const reportStatus = pgEnum("report_status", [
  "submitted",
  "reviewing",
  "accepted",
  "needs_info",
  "duplicate",
  "rejected",
  "assigned",
  "in_progress",
  "ready_for_review",
  "resolved",
  "archived",
])

export const reportAssetType = pgEnum("report_asset_type", [
  "page_screenshot",
  "element_screenshot",
  "annotated_screenshot",
])

const timestamps = () => ({
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
})

export type ReportViewport = {
  width: number
  height: number
  devicePixelRatio: number
  scrollX: number
  scrollY: number
}

export type ReportSelectedElement = {
  tag: string
  selector: string
  text?: string
  attributes?: Record<string, string>
  boundingBox?: {
    x: number
    y: number
    width: number
    height: number
  }
}

export type ReportImplementationReferenceLink = {
  label?: string
  url: string
}

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: varchar("email", { length: 320 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    ...timestamps(),
  },
  (table) => [uniqueIndex("users_email_unique").on(sql`lower(${table.email})`)]
)

export const userProfiles = pgTable(
  "user_profiles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    fullName: varchar("full_name", { length: 160 }).notNull(),
    displayName: varchar("display_name", { length: 80 }).notNull(),
    title: varchar("title", { length: 120 }),
    avatarUrl: text("avatar_url"),
    onboardingCompletedAt: timestamp("onboarding_completed_at", {
      withTimezone: true,
    }),
    ...timestamps(),
  },
  (table) => [uniqueIndex("user_profiles_user_id_unique").on(table.userId)]
)

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("sessions_token_hash_unique").on(table.tokenHash),
    index("sessions_user_id_idx").on(table.userId),
    index("sessions_expires_at_idx").on(table.expiresAt),
  ]
)

// Personal access tokens let a developer connect one workspace to a coding agent
// over MCP. Workspace-scoped, only the hash is stored (mirror sessions), and the
// token inherits the member's role at use time.
export const personalAccessTokens = pgTable(
  "personal_access_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    label: varchar("label", { length: 120 }).notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("personal_access_tokens_token_hash_unique").on(table.tokenHash),
    index("personal_access_tokens_workspace_id_idx").on(table.workspaceId),
    index("personal_access_tokens_user_id_idx").on(table.userId),
  ]
)

export const workspaces = pgTable(
  "workspaces",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 120 }).notNull(),
    slug: varchar("slug", { length: 80 }).notNull(),
    logoUrl: text("logo_url"),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("workspaces_slug_unique").on(table.slug),
    index("workspaces_created_by_user_id_idx").on(table.createdByUserId),
  ]
)

export const workspaceMemberships = pgTable(
  "workspace_memberships",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: workspaceRole("role").notNull(),
    status: membershipStatus("status").default("active").notNull(),
    invitedByUserId: uuid("invited_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("workspace_memberships_workspace_user_unique").on(
      table.workspaceId,
      table.userId
    ),
    index("workspace_memberships_user_id_idx").on(table.userId),
    index("workspace_memberships_workspace_id_idx").on(table.workspaceId),
  ]
)

export const workspaceDomains = pgTable(
  "workspace_domains",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    host: varchar("host", { length: 253 }).notNull(),
    status: domainStatus("status").default("active").notNull(),
    addedByUserId: uuid("added_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("workspace_domains_workspace_host_unique").on(
      table.workspaceId,
      table.host
    ),
    index("workspace_domains_host_idx").on(table.host),
    index("workspace_domains_workspace_id_idx").on(table.workspaceId),
  ]
)

export const workspaceInvites = pgTable(
  "workspace_invites",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    code: varchar("code", { length: 128 }).notNull(),
    role: workspaceRole("role").notNull(),
    status: inviteStatus("status").default("active").notNull(),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    maxUses: integer("max_uses"),
    usedCount: integer("used_count").default(0).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("workspace_invites_code_unique").on(table.code),
    index("workspace_invites_workspace_id_idx").on(table.workspaceId),
    check("workspace_invites_used_count_nonneg", sql`${table.usedCount} >= 0`),
    check(
      "workspace_invites_max_uses_positive",
      sql`${table.maxUses} IS NULL OR ${table.maxUses} > 0`
    ),
    check(
      "workspace_invites_not_overused",
      sql`${table.maxUses} IS NULL OR ${table.usedCount} <= ${table.maxUses}`
    ),
  ]
)

export const reports = pgTable(
  "reports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 180 }).notNull(),
    summary: text("summary").notNull(),
    severity: reportSeverity("severity").default("medium").notNull(),
    status: reportStatus("status").default("submitted").notNull(),
    type: reportType("type").default("ux").notNull(),
    clientReportId: varchar("client_report_id", { length: 160 }),
    domain: varchar("domain", { length: 253 }).notNull(),
    url: text("url").notNull(),
    browser: varchar("browser", { length: 120 }),
    device: varchar("device", { length: 120 }),
    viewport: jsonb("viewport").$type<ReportViewport>().notNull(),
    selectedElement: jsonb("selected_element").$type<ReportSelectedElement>().notNull(),
    feedbackMessage: text("feedback_message").notNull(),
    developerPrompt: text("developer_prompt"),
    reporterUserId: uuid("reporter_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    assigneeUserId: uuid("assignee_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    capturedAt: timestamp("captured_at", { withTimezone: true }).defaultNow().notNull(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps(),
  },
  (table) => [
    unique("reports_id_workspace_id_unique").on(table.id, table.workspaceId),
    unique("reports_workspace_client_report_id_unique").on(
      table.workspaceId,
      table.clientReportId
    ),
    index("reports_workspace_status_idx").on(table.workspaceId, table.status),
    index("reports_workspace_assignee_idx").on(table.workspaceId, table.assigneeUserId),
    index("reports_workspace_reporter_idx").on(table.workspaceId, table.reporterUserId),
    index("reports_workspace_domain_idx").on(table.workspaceId, table.domain),
  ]
)

export const reportAssets = pgTable(
  "report_assets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    reportId: uuid("report_id")
      .notNull()
      .references(() => reports.id, { onDelete: "cascade" }),
    type: reportAssetType("type").notNull(),
    url: text("url").notNull(),
    mimeType: varchar("mime_type", { length: 80 }),
    width: integer("width"),
    height: integer("height"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("report_assets_workspace_id_idx").on(table.workspaceId),
    index("report_assets_report_id_idx").on(table.reportId),
    foreignKey({
      name: "report_assets_report_workspace_fk",
      columns: [table.reportId, table.workspaceId],
      foreignColumns: [reports.id, reports.workspaceId],
    }).onDelete("cascade"),
  ]
)

export const reportImplementationBriefs = pgTable(
  "report_implementation_briefs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    reportId: uuid("report_id")
      .notNull()
      .references(() => reports.id, { onDelete: "cascade" }),
    acceptanceCriteria: jsonb("acceptance_criteria")
      .$type<string[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    implementationNotes: text("implementation_notes"),
    constraintsNonGoals: jsonb("constraints_non_goals")
      .$type<string[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    expectedBehavior: text("expected_behavior"),
    referenceLinks: jsonb("reference_links")
      .$type<ReportImplementationReferenceLink[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    reviewChecklist: jsonb("review_checklist")
      .$type<string[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    updatedByUserId: uuid("updated_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("report_implementation_briefs_report_unique").on(
      table.workspaceId,
      table.reportId
    ),
    index("report_implementation_briefs_workspace_id_idx").on(table.workspaceId),
    index("report_implementation_briefs_updated_by_user_id_idx").on(
      table.updatedByUserId
    ),
    foreignKey({
      name: "report_implementation_briefs_report_workspace_fk",
      columns: [table.reportId, table.workspaceId],
      foreignColumns: [reports.id, reports.workspaceId],
    }).onDelete("cascade"),
  ]
)

export const reportComments = pgTable(
  "report_comments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    reportId: uuid("report_id")
      .notNull()
      .references(() => reports.id, { onDelete: "cascade" }),
    authorUserId: uuid("author_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    body: text("body").notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...timestamps(),
  },
  (table) => [
    index("report_comments_workspace_id_idx").on(table.workspaceId),
    index("report_comments_report_id_idx").on(table.reportId),
    index("report_comments_author_user_id_idx").on(table.authorUserId),
    foreignKey({
      name: "report_comments_report_workspace_fk",
      columns: [table.reportId, table.workspaceId],
      foreignColumns: [reports.id, reports.workspaceId],
    }).onDelete("cascade"),
  ]
)

export const reportStatusEvents = pgTable(
  "report_status_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    reportId: uuid("report_id")
      .notNull()
      .references(() => reports.id, { onDelete: "cascade" }),
    actorUserId: uuid("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    fromStatus: reportStatus("from_status"),
    toStatus: reportStatus("to_status").notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("report_status_events_workspace_id_idx").on(table.workspaceId),
    index("report_status_events_report_id_idx").on(table.reportId),
    index("report_status_events_actor_user_id_idx").on(table.actorUserId),
    foreignKey({
      name: "report_status_events_report_workspace_fk",
      columns: [table.reportId, table.workspaceId],
      foreignColumns: [reports.id, reports.workspaceId],
    }).onDelete("cascade"),
  ]
)

export const usersRelations = relations(users, ({ one, many }) => ({
  profile: one(userProfiles, {
    fields: [users.id],
    references: [userProfiles.userId],
    relationName: "userProfile",
  }),
  sessions: many(sessions, { relationName: "userSessions" }),
  memberships: many(workspaceMemberships, { relationName: "membershipUser" }),
  invitedMemberships: many(workspaceMemberships, {
    relationName: "membershipInviter",
  }),
  createdWorkspaces: many(workspaces, { relationName: "workspaceCreator" }),
  domainsAdded: many(workspaceDomains, { relationName: "domainAdder" }),
  invitesCreated: many(workspaceInvites, { relationName: "inviteCreator" }),
  reportsSubmitted: many(reports, { relationName: "reporter" }),
  reportsAssigned: many(reports, { relationName: "assignee" }),
}))

export const userProfilesRelations = relations(userProfiles, ({ one }) => ({
  user: one(users, {
    fields: [userProfiles.userId],
    references: [users.id],
    relationName: "userProfile",
  }),
}))

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
    relationName: "userSessions",
  }),
}))

export const workspacesRelations = relations(workspaces, ({ one, many }) => ({
  createdBy: one(users, {
    fields: [workspaces.createdByUserId],
    references: [users.id],
    relationName: "workspaceCreator",
  }),
  memberships: many(workspaceMemberships),
  domains: many(workspaceDomains),
  invites: many(workspaceInvites),
  reports: many(reports),
}))

export const workspaceMembershipsRelations = relations(
  workspaceMemberships,
  ({ one }) => ({
    workspace: one(workspaces, {
      fields: [workspaceMemberships.workspaceId],
      references: [workspaces.id],
    }),
    user: one(users, {
      fields: [workspaceMemberships.userId],
      references: [users.id],
      relationName: "membershipUser",
    }),
    invitedBy: one(users, {
      fields: [workspaceMemberships.invitedByUserId],
      references: [users.id],
      relationName: "membershipInviter",
    }),
  })
)

export const workspaceDomainsRelations = relations(workspaceDomains, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [workspaceDomains.workspaceId],
    references: [workspaces.id],
  }),
  addedBy: one(users, {
    fields: [workspaceDomains.addedByUserId],
    references: [users.id],
    relationName: "domainAdder",
  }),
}))

export const workspaceInvitesRelations = relations(workspaceInvites, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [workspaceInvites.workspaceId],
    references: [workspaces.id],
  }),
  createdBy: one(users, {
    fields: [workspaceInvites.createdByUserId],
    references: [users.id],
    relationName: "inviteCreator",
  }),
}))

export const reportsRelations = relations(reports, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [reports.workspaceId],
    references: [workspaces.id],
  }),
  reporter: one(users, {
    fields: [reports.reporterUserId],
    references: [users.id],
    relationName: "reporter",
  }),
  assignee: one(users, {
    fields: [reports.assigneeUserId],
    references: [users.id],
    relationName: "assignee",
  }),
  assets: many(reportAssets),
  implementationBrief: one(reportImplementationBriefs, {
    fields: [reports.id, reports.workspaceId],
    references: [
      reportImplementationBriefs.reportId,
      reportImplementationBriefs.workspaceId,
    ],
  }),
  comments: many(reportComments),
  statusEvents: many(reportStatusEvents),
}))

export const reportAssetsRelations = relations(reportAssets, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [reportAssets.workspaceId],
    references: [workspaces.id],
  }),
  report: one(reports, {
    fields: [reportAssets.reportId],
    references: [reports.id],
  }),
}))

export const reportImplementationBriefsRelations = relations(
  reportImplementationBriefs,
  ({ one }) => ({
    workspace: one(workspaces, {
      fields: [reportImplementationBriefs.workspaceId],
      references: [workspaces.id],
    }),
    report: one(reports, {
      fields: [reportImplementationBriefs.reportId],
      references: [reports.id],
    }),
    updatedBy: one(users, {
      fields: [reportImplementationBriefs.updatedByUserId],
      references: [users.id],
    }),
  })
)

export const reportCommentsRelations = relations(reportComments, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [reportComments.workspaceId],
    references: [workspaces.id],
  }),
  report: one(reports, {
    fields: [reportComments.reportId],
    references: [reports.id],
  }),
  author: one(users, {
    fields: [reportComments.authorUserId],
    references: [users.id],
  }),
}))

export const reportStatusEventsRelations = relations(
  reportStatusEvents,
  ({ one }) => ({
    workspace: one(workspaces, {
      fields: [reportStatusEvents.workspaceId],
      references: [workspaces.id],
    }),
    report: one(reports, {
      fields: [reportStatusEvents.reportId],
      references: [reports.id],
    }),
    actor: one(users, {
      fields: [reportStatusEvents.actorUserId],
      references: [users.id],
    }),
  })
)

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type UserProfile = typeof userProfiles.$inferSelect
export type NewUserProfile = typeof userProfiles.$inferInsert
export type Workspace = typeof workspaces.$inferSelect
export type NewWorkspace = typeof workspaces.$inferInsert
export type WorkspaceMembership = typeof workspaceMemberships.$inferSelect
export type NewWorkspaceMembership = typeof workspaceMemberships.$inferInsert
export type WorkspaceDomain = typeof workspaceDomains.$inferSelect
export type NewWorkspaceDomain = typeof workspaceDomains.$inferInsert
export type Report = typeof reports.$inferSelect
export type NewReport = typeof reports.$inferInsert
export type ReportImplementationBrief = typeof reportImplementationBriefs.$inferSelect
export type NewReportImplementationBrief = typeof reportImplementationBriefs.$inferInsert
