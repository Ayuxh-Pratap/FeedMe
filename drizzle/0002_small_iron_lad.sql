CREATE TABLE "report_implementation_briefs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"report_id" uuid NOT NULL,
	"acceptance_criteria" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"implementation_notes" text,
	"constraints_non_goals" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"expected_behavior" text,
	"reference_links" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"review_checklist" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "report_implementation_briefs" ADD CONSTRAINT "report_implementation_briefs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_implementation_briefs" ADD CONSTRAINT "report_implementation_briefs_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_implementation_briefs" ADD CONSTRAINT "report_implementation_briefs_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_implementation_briefs" ADD CONSTRAINT "report_implementation_briefs_report_workspace_fk" FOREIGN KEY ("report_id","workspace_id") REFERENCES "public"."reports"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "report_implementation_briefs_report_unique" ON "report_implementation_briefs" USING btree ("workspace_id","report_id");--> statement-breakpoint
CREATE INDEX "report_implementation_briefs_workspace_id_idx" ON "report_implementation_briefs" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "report_implementation_briefs_updated_by_user_id_idx" ON "report_implementation_briefs" USING btree ("updated_by_user_id");