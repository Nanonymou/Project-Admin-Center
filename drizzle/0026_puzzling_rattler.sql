CREATE TYPE "public"."daily_closing_action" AS ENUM('open', 'submit', 'approve', 'reject', 'lock', 'reopen');--> statement-breakpoint
CREATE TABLE "daily_closing_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"closing_id" uuid NOT NULL,
	"project_id" varchar(32) NOT NULL,
	"location_id" varchar(64) NOT NULL,
	"action" "daily_closing_action" NOT NULL,
	"from_status" varchar(32),
	"to_status" varchar(32),
	"actor" varchar(128) NOT NULL,
	"note" varchar(512),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "daily_closing_history" ADD CONSTRAINT "daily_closing_history_closing_id_daily_closings_id_fk" FOREIGN KEY ("closing_id") REFERENCES "public"."daily_closings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "daily_closing_history_closing_idx" ON "daily_closing_history" USING btree ("closing_id");--> statement-breakpoint
CREATE INDEX "daily_closing_history_tenant_idx" ON "daily_closing_history" USING btree ("project_id","location_id");--> statement-breakpoint
CREATE INDEX "daily_closing_history_created_idx" ON "daily_closing_history" USING btree ("created_at");