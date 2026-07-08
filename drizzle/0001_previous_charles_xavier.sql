CREATE TABLE IF NOT EXISTS "personal_access_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"label" varchar(120) NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "client_report_id" varchar(160);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "personal_access_tokens" ADD CONSTRAINT "personal_access_tokens_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "personal_access_tokens" ADD CONSTRAINT "personal_access_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "personal_access_tokens_token_hash_unique" ON "personal_access_tokens" USING btree ("token_hash");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "personal_access_tokens_workspace_id_idx" ON "personal_access_tokens" USING btree ("workspace_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "personal_access_tokens_user_id_idx" ON "personal_access_tokens" USING btree ("user_id");
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "reports" ADD CONSTRAINT "reports_workspace_client_report_id_unique" UNIQUE("workspace_id","client_report_id");
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;
