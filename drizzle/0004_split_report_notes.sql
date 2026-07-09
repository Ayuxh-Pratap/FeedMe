CREATE TYPE "public"."report_note_kind" AS ENUM('work_note', 'blocker', 'clarification', 'review_note');--> statement-breakpoint
CREATE TABLE "report_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"report_id" uuid NOT NULL,
	"author_user_id" uuid,
	"kind" "report_note_kind" NOT NULL,
	"body" text NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
INSERT INTO "report_notes" (
	"id",
	"workspace_id",
	"report_id",
	"author_user_id",
	"kind",
	"body",
	"deleted_at",
	"created_at",
	"updated_at"
)
SELECT
	"id",
	"workspace_id",
	"report_id",
	"author_user_id",
	"kind"::text::"report_note_kind",
	"body",
	"deleted_at",
	"created_at",
	"updated_at"
FROM "report_comments"
WHERE "kind" <> 'comment';
--> statement-breakpoint
DELETE FROM "report_comments" WHERE "kind" <> 'comment';--> statement-breakpoint
ALTER TABLE "report_comments" ADD COLUMN "parent_comment_id" uuid;--> statement-breakpoint
ALTER TABLE "report_comments" DROP COLUMN "kind";--> statement-breakpoint
DROP TYPE "public"."report_comment_kind";--> statement-breakpoint
ALTER TABLE "report_notes" ADD CONSTRAINT "report_notes_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_notes" ADD CONSTRAINT "report_notes_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_notes" ADD CONSTRAINT "report_notes_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_notes" ADD CONSTRAINT "report_notes_report_workspace_fk" FOREIGN KEY ("report_id","workspace_id") REFERENCES "public"."reports"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_comments" ADD CONSTRAINT "report_comments_parent_comment_id_report_comments_id_fk" FOREIGN KEY ("parent_comment_id") REFERENCES "public"."report_comments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "report_notes_workspace_id_idx" ON "report_notes" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "report_notes_report_id_idx" ON "report_notes" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX "report_notes_author_user_id_idx" ON "report_notes" USING btree ("author_user_id");--> statement-breakpoint
CREATE INDEX "report_comments_parent_comment_id_idx" ON "report_comments" USING btree ("parent_comment_id");
