CREATE TYPE "public"."submission_history_action" AS ENUM('submit', 'review', 'approve', 'reject', 'resubmit');--> statement-breakpoint
CREATE TABLE "daily_submission_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid NOT NULL,
	"project_id" varchar(32) NOT NULL,
	"location_id" varchar(64) NOT NULL,
	"action" "submission_history_action" NOT NULL,
	"from_status" varchar(24),
	"to_status" varchar(24) NOT NULL,
	"actor" varchar(128),
	"reason" varchar(512),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "daily_submission_history" ADD CONSTRAINT "daily_submission_history_submission_id_daily_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."daily_submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "daily_submission_history_submission_idx" ON "daily_submission_history" USING btree ("submission_id");--> statement-breakpoint
CREATE INDEX "daily_submission_history_tenant_idx" ON "daily_submission_history" USING btree ("project_id","location_id");