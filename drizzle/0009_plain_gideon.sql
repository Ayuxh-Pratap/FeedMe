CREATE TYPE "public"."report_source" AS ENUM('feedback', 'task');--> statement-breakpoint
ALTER TABLE "reports" ALTER COLUMN "domain" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "reports" ALTER COLUMN "url" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "reports" ALTER COLUMN "viewport" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "reports" ALTER COLUMN "selected_element" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "source" "report_source" DEFAULT 'feedback' NOT NULL;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "client_payload_hash" varchar(64);