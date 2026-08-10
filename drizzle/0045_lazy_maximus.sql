CREATE TYPE "public"."daily_submission_kind" AS ENUM('sales', 'cost');--> statement-breakpoint
CREATE TYPE "public"."daily_submission_status" AS ENUM('draft', 'submitted', 'reviewed', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "daily_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar(32) NOT NULL,
	"location_id" varchar(64) NOT NULL,
	"kind" "daily_submission_kind" NOT NULL,
	"submission_date" date NOT NULL,
	"status" "daily_submission_status" DEFAULT 'draft' NOT NULL,
	"total_amount" numeric(18, 2) DEFAULT '0' NOT NULL,
	"entry_count" integer DEFAULT 0 NOT NULL,
	"submitted_by" varchar(128),
	"submitted_at" timestamp with time zone,
	"reviewed_by" varchar(128),
	"reviewed_at" timestamp with time zone,
	"note" varchar(512),
	"created_by" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "daily_submissions_tenant_idx" ON "daily_submissions" USING btree ("project_id","location_id");--> statement-breakpoint
CREATE INDEX "daily_submissions_kind_idx" ON "daily_submissions" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "daily_submissions_status_idx" ON "daily_submissions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "daily_submissions_date_idx" ON "daily_submissions" USING btree ("submission_date");