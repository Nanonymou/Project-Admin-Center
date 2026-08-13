CREATE TABLE "reminder_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"level" varchar(16) DEFAULT 'info' NOT NULL,
	"trigger" varchar(24) NOT NULL,
	"title" varchar(192) NOT NULL,
	"channel" varchar(16) DEFAULT 'in-app' NOT NULL,
	"status" varchar(16) DEFAULT 'sent' NOT NULL,
	"audience" varchar(16) DEFAULT 'Site' NOT NULL,
	"project_code" varchar(32),
	"location_id" varchar(64),
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "reminder_logs_site_idx" ON "reminder_logs" USING btree ("project_code","location_id");--> statement-breakpoint
CREATE INDEX "reminder_logs_sent_idx" ON "reminder_logs" USING btree ("sent_at");