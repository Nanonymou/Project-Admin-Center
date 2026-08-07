CREATE TYPE "public"."period_action" AS ENUM('open', 'start_closing', 'close', 'lock', 'unlock', 'reopen');--> statement-breakpoint
CREATE TYPE "public"."period_status" AS ENUM('open', 'closing', 'closed', 'locked');--> statement-breakpoint
CREATE TABLE "period_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"period_id" uuid NOT NULL,
	"project_id" varchar(32) NOT NULL,
	"location_id" varchar(64) NOT NULL,
	"action" "period_action" NOT NULL,
	"actor" varchar(128) NOT NULL,
	"note" varchar(512),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar(32) NOT NULL,
	"location_id" varchar(64) NOT NULL,
	"period_label" varchar(64) NOT NULL,
	"period_type" varchar(16),
	"period_start" date,
	"period_end" date,
	"status" "period_status" DEFAULT 'open' NOT NULL,
	"created_by" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "period_history" ADD CONSTRAINT "period_history_period_id_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."periods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "period_history_period_idx" ON "period_history" USING btree ("period_id");--> statement-breakpoint
CREATE INDEX "period_history_tenant_idx" ON "period_history" USING btree ("project_id","location_id");--> statement-breakpoint
CREATE INDEX "period_history_created_idx" ON "period_history" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "periods_period_idx" ON "periods" USING btree ("project_id","location_id","period_label");--> statement-breakpoint
CREATE INDEX "periods_tenant_idx" ON "periods" USING btree ("project_id","location_id");--> statement-breakpoint
CREATE INDEX "periods_status_idx" ON "periods" USING btree ("status");