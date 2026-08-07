CREATE TYPE "public"."daily_closing_status_kind" AS ENUM('open', 'submitted', 'approved', 'locked');--> statement-breakpoint
CREATE TABLE "daily_closings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar(32) NOT NULL,
	"location_id" varchar(64) NOT NULL,
	"closing_date" date NOT NULL,
	"status" "daily_closing_status_kind" DEFAULT 'open' NOT NULL,
	"submitted_by" varchar(128),
	"submitted_at" timestamp with time zone,
	"approved_by" varchar(128),
	"approved_at" timestamp with time zone,
	"locked_at" timestamp with time zone,
	"note" varchar(512),
	"created_by" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "daily_closings_day_idx" ON "daily_closings" USING btree ("project_id","location_id","closing_date");--> statement-breakpoint
CREATE INDEX "daily_closings_tenant_idx" ON "daily_closings" USING btree ("project_id","location_id");--> statement-breakpoint
CREATE INDEX "daily_closings_status_idx" ON "daily_closings" USING btree ("status");