CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipient" varchar(128) NOT NULL,
	"source" varchar(24) DEFAULT 'system' NOT NULL,
	"level" varchar(16) DEFAULT 'info' NOT NULL,
	"title" varchar(192) NOT NULL,
	"detail" varchar(512) DEFAULT '' NOT NULL,
	"href" varchar(256),
	"project_code" varchar(32),
	"location_id" varchar(64),
	"read" boolean DEFAULT false NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "notifications_recipient_idx" ON "notifications" USING btree ("recipient");--> statement-breakpoint
CREATE INDEX "notifications_unread_idx" ON "notifications" USING btree ("recipient","read");--> statement-breakpoint
CREATE INDEX "notifications_created_idx" ON "notifications" USING btree ("created_at");