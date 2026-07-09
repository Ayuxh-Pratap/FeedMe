CREATE TYPE "public"."notification_type" AS ENUM('report_assigned', 'comment_reply', 'comment_mention', 'admin_comment_added', 'clarification_added', 'blocker_added', 'ready_for_review', 'report_resolved');--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"recipient_user_id" uuid NOT NULL,
	"actor_user_id" uuid,
	"report_id" uuid,
	"comment_id" uuid,
	"note_id" uuid,
	"type" "notification_type" NOT NULL,
	"title" varchar(180) NOT NULL,
	"body" text NOT NULL,
	"href" text NOT NULL,
	"dedupe_key" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"read_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_comment_mentions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"report_id" uuid NOT NULL,
	"comment_id" uuid NOT NULL,
	"mentioned_user_id" uuid NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_user_id_users_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_comment_id_report_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."report_comments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_note_id_report_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."report_notes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_report_workspace_fk" FOREIGN KEY ("report_id","workspace_id") REFERENCES "public"."reports"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_comment_mentions" ADD CONSTRAINT "report_comment_mentions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_comment_mentions" ADD CONSTRAINT "report_comment_mentions_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_comment_mentions" ADD CONSTRAINT "report_comment_mentions_comment_id_report_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."report_comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_comment_mentions" ADD CONSTRAINT "report_comment_mentions_mentioned_user_id_users_id_fk" FOREIGN KEY ("mentioned_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_comment_mentions" ADD CONSTRAINT "report_comment_mentions_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_comment_mentions" ADD CONSTRAINT "report_comment_mentions_report_workspace_fk" FOREIGN KEY ("report_id","workspace_id") REFERENCES "public"."reports"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_dedupe_unique" ON "notifications" USING btree ("workspace_id","recipient_user_id","dedupe_key");--> statement-breakpoint
CREATE INDEX "notifications_workspace_recipient_idx" ON "notifications" USING btree ("workspace_id","recipient_user_id");--> statement-breakpoint
CREATE INDEX "notifications_recipient_read_idx" ON "notifications" USING btree ("recipient_user_id","read_at");--> statement-breakpoint
CREATE INDEX "notifications_report_id_idx" ON "notifications" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX "notifications_created_at_idx" ON "notifications" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "report_comment_mentions_unique" ON "report_comment_mentions" USING btree ("comment_id","mentioned_user_id");--> statement-breakpoint
CREATE INDEX "report_comment_mentions_workspace_id_idx" ON "report_comment_mentions" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "report_comment_mentions_report_id_idx" ON "report_comment_mentions" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX "report_comment_mentions_comment_id_idx" ON "report_comment_mentions" USING btree ("comment_id");--> statement-breakpoint
CREATE INDEX "report_comment_mentions_mentioned_user_id_idx" ON "report_comment_mentions" USING btree ("mentioned_user_id");