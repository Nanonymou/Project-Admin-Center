CREATE TABLE "storage_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar(32),
	"category" varchar(48) NOT NULL,
	"size_bytes" bigint DEFAULT 0 NOT NULL,
	"item_count" integer DEFAULT 0 NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_activity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"persona_id" varchar(64) NOT NULL,
	"actor_name" varchar(128),
	"role" varchar(32),
	"action" varchar(64) NOT NULL,
	"project_id" varchar(32),
	"location_id" varchar(64),
	"ip_address" varchar(64),
	"user_agent" varchar(256),
	"detail" varchar(512),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "storage_metrics_project_idx" ON "storage_metrics" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "storage_metrics_category_idx" ON "storage_metrics" USING btree ("category");--> statement-breakpoint
CREATE INDEX "storage_metrics_captured_idx" ON "storage_metrics" USING btree ("captured_at");--> statement-breakpoint
CREATE INDEX "user_activity_persona_idx" ON "user_activity" USING btree ("persona_id");--> statement-breakpoint
CREATE INDEX "user_activity_action_idx" ON "user_activity" USING btree ("action");--> statement-breakpoint
CREATE INDEX "user_activity_created_idx" ON "user_activity" USING btree ("created_at");