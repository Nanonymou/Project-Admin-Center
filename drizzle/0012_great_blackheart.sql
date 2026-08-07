CREATE TYPE "public"."cutoff_status" AS ENUM('on_track', 'closing_soon', 'critical', 'locked');--> statement-breakpoint
CREATE TYPE "public"."delivery_status" AS ENUM('not_started', 'in_progress', 'sent', 'confirmed');--> statement-breakpoint
CREATE TABLE "cutoff_monitoring" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar(32) NOT NULL,
	"location_id" varchar(64) NOT NULL,
	"period_label" varchar(64) NOT NULL,
	"cut_off_date" date,
	"status" "cutoff_status" DEFAULT 'on_track' NOT NULL,
	"submitted_pct" integer DEFAULT 0 NOT NULL,
	"delivery" "delivery_status" DEFAULT 'not_started' NOT NULL,
	"pending_invoices" integer DEFAULT 0 NOT NULL,
	"created_by" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "cutoff_monitoring_period_idx" ON "cutoff_monitoring" USING btree ("project_id","location_id","period_label");--> statement-breakpoint
CREATE INDEX "cutoff_monitoring_tenant_idx" ON "cutoff_monitoring" USING btree ("project_id","location_id");--> statement-breakpoint
CREATE INDEX "cutoff_monitoring_status_idx" ON "cutoff_monitoring" USING btree ("status");