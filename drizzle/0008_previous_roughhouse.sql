CREATE TYPE "public"."auth_action_token_purpose" AS ENUM('email_verification', 'password_reset');--> statement-breakpoint
CREATE TABLE "auth_action_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"purpose" "auth_action_token_purpose" NOT NULL,
	"token_hash" text NOT NULL,
	"redirect_path" text,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"dedupe_key" varchar(240) NOT NULL,
	"payload" jsonb NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"dead_lettered_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_outbox_attempts_nonnegative" CHECK ("notification_outbox"."attempts" >= 0)
);
--> statement-breakpoint
CREATE TABLE "rate_limit_buckets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope" varchar(80) NOT NULL,
	"key_hash" varchar(64) NOT NULL,
	"hit_count" integer DEFAULT 1 NOT NULL,
	"window_started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"window_expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rate_limit_buckets_hit_count_positive" CHECK ("rate_limit_buckets"."hit_count" > 0)
);
--> statement-breakpoint
CREATE TABLE "workspace_invite_acceptances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invite_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "personal_access_tokens" ADD COLUMN "expires_at" timestamp with time zone;--> statement-breakpoint
UPDATE "personal_access_tokens"
SET "expires_at" = now() + interval '90 days'
WHERE "expires_at" IS NULL;--> statement-breakpoint
ALTER TABLE "personal_access_tokens" ALTER COLUMN "expires_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "report_comments" ADD COLUMN "client_mutation_id" varchar(160);--> statement-breakpoint
ALTER TABLE "auth_action_tokens" ADD CONSTRAINT "auth_action_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_outbox" ADD CONSTRAINT "notification_outbox_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_invite_acceptances" ADD CONSTRAINT "workspace_invite_acceptances_invite_id_workspace_invites_id_fk" FOREIGN KEY ("invite_id") REFERENCES "public"."workspace_invites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_invite_acceptances" ADD CONSTRAINT "workspace_invite_acceptances_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_invite_acceptances" ADD CONSTRAINT "workspace_invite_acceptances_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "auth_action_tokens_token_hash_unique" ON "auth_action_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "auth_action_tokens_user_purpose_idx" ON "auth_action_tokens" USING btree ("user_id","purpose");--> statement-breakpoint
CREATE INDEX "auth_action_tokens_expires_at_idx" ON "auth_action_tokens" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_outbox_dedupe_unique" ON "notification_outbox" USING btree ("workspace_id","dedupe_key");--> statement-breakpoint
CREATE INDEX "notification_outbox_delivery_idx" ON "notification_outbox" USING btree ("workspace_id","processed_at","available_at");--> statement-breakpoint
CREATE UNIQUE INDEX "rate_limit_buckets_scope_key_unique" ON "rate_limit_buckets" USING btree ("scope","key_hash");--> statement-breakpoint
CREATE INDEX "rate_limit_buckets_expires_at_idx" ON "rate_limit_buckets" USING btree ("window_expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_invite_acceptances_invite_user_unique" ON "workspace_invite_acceptances" USING btree ("invite_id","user_id");--> statement-breakpoint
CREATE INDEX "workspace_invite_acceptances_workspace_id_idx" ON "workspace_invite_acceptances" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "workspace_invite_acceptances_user_id_idx" ON "workspace_invite_acceptances" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "personal_access_tokens_expires_at_idx" ON "personal_access_tokens" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "report_comments_workspace_client_mutation_unique" ON "report_comments" USING btree ("workspace_id","client_mutation_id");--> statement-breakpoint
UPDATE "users"
SET "email_verified_at" = COALESCE("email_verified_at", "created_at")
WHERE "email_verified_at" IS NULL;--> statement-breakpoint
UPDATE "reports"
SET "status" = 'reviewing', "updated_at" = now()
WHERE "status" IN ('assigned', 'in_progress', 'ready_for_review')
  AND "assignee_user_id" IS NULL;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_workflow_status_requires_assignee" CHECK ("reports"."status" NOT IN ('assigned', 'in_progress', 'ready_for_review') OR "reports"."assignee_user_id" IS NOT NULL);
