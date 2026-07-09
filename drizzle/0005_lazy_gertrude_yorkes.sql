CREATE TYPE "public"."report_comment_reaction" AS ENUM('seen', 'agree', 'blocked', 'helpful');--> statement-breakpoint
CREATE TABLE "report_comment_reactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"report_id" uuid NOT NULL,
	"comment_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"reaction" "report_comment_reaction" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "report_comments" ADD COLUMN "edited_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "report_comment_reactions" ADD CONSTRAINT "report_comment_reactions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_comment_reactions" ADD CONSTRAINT "report_comment_reactions_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_comment_reactions" ADD CONSTRAINT "report_comment_reactions_comment_id_report_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."report_comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_comment_reactions" ADD CONSTRAINT "report_comment_reactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_comment_reactions" ADD CONSTRAINT "report_comment_reactions_report_workspace_fk" FOREIGN KEY ("report_id","workspace_id") REFERENCES "public"."reports"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "report_comment_reactions_unique" ON "report_comment_reactions" USING btree ("comment_id","user_id","reaction");--> statement-breakpoint
CREATE INDEX "report_comment_reactions_workspace_id_idx" ON "report_comment_reactions" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "report_comment_reactions_report_id_idx" ON "report_comment_reactions" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX "report_comment_reactions_comment_id_idx" ON "report_comment_reactions" USING btree ("comment_id");--> statement-breakpoint
CREATE INDEX "report_comment_reactions_user_id_idx" ON "report_comment_reactions" USING btree ("user_id");