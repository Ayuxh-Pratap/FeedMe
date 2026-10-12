CREATE TYPE "public"."auth_email_template" AS ENUM('email_verification', 'password_reset', 'existing_account');--> statement-breakpoint
CREATE TABLE "auth_email_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"recipient_email" varchar(320) NOT NULL,
	"template" "auth_email_template" NOT NULL,
	"dedupe_key" varchar(240) NOT NULL,
	"payload" jsonb NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"dead_lettered_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_email_outbox_attempts_nonnegative" CHECK ("auth_email_outbox"."attempts" >= 0)
);
--> statement-breakpoint
ALTER TABLE "auth_email_outbox" ADD CONSTRAINT "auth_email_outbox_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "auth_email_outbox_dedupe_unique" ON "auth_email_outbox" USING btree ("dedupe_key");--> statement-breakpoint
CREATE INDEX "auth_email_outbox_delivery_idx" ON "auth_email_outbox" USING btree ("processed_at","dead_lettered_at","available_at");--> statement-breakpoint
CREATE INDEX "auth_email_outbox_user_id_idx" ON "auth_email_outbox" USING btree ("user_id");
