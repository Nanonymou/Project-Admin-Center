CREATE TYPE "public"."unlock_request_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "unlock_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar(32) NOT NULL,
	"location_id" varchar(64) NOT NULL,
	"period_label" varchar(64) NOT NULL,
	"status" "unlock_request_status" DEFAULT 'pending' NOT NULL,
	"requested_by" varchar(128),
	"reason" varchar(512),
	"reviewed_by" varchar(128),
	"reviewed_at" timestamp with time zone,
	"review_note" varchar(512),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "unlock_requests_tenant_idx" ON "unlock_requests" USING btree ("project_id","location_id");--> statement-breakpoint
CREATE INDEX "unlock_requests_status_idx" ON "unlock_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "unlock_requests_period_idx" ON "unlock_requests" USING btree ("project_id","location_id","period_label");