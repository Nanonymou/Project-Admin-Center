CREATE TYPE "public"."lock_period_action" AS ENUM('lock', 'unlock');--> statement-breakpoint
CREATE TABLE "lock_period_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar(32) NOT NULL,
	"location_id" varchar(64) NOT NULL,
	"period_label" varchar(64) NOT NULL,
	"action" "lock_period_action" NOT NULL,
	"actor" varchar(128),
	"reason" varchar(512),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "lock_period_history_tenant_idx" ON "lock_period_history" USING btree ("project_id","location_id");--> statement-breakpoint
CREATE INDEX "lock_period_history_period_idx" ON "lock_period_history" USING btree ("project_id","location_id","period_label");--> statement-breakpoint
CREATE INDEX "lock_period_history_action_idx" ON "lock_period_history" USING btree ("action");