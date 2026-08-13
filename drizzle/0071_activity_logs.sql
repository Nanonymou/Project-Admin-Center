CREATE TABLE "activity_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action" varchar(24) NOT NULL,
	"actor" varchar(128) NOT NULL,
	"role" varchar(48) DEFAULT '' NOT NULL,
	"target" varchar(192) DEFAULT '' NOT NULL,
	"project_code" varchar(32),
	"location_id" varchar(64),
	"detail" varchar(512) DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "activity_logs_site_idx" ON "activity_logs" USING btree ("project_code","location_id");--> statement-breakpoint
CREATE INDEX "activity_logs_actor_idx" ON "activity_logs" USING btree ("actor");--> statement-breakpoint
CREATE INDEX "activity_logs_created_idx" ON "activity_logs" USING btree ("created_at");