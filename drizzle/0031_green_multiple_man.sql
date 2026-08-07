CREATE TYPE "public"."backup_job_status" AS ENUM('pending', 'running', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."backup_kind" AS ENUM('full', 'incremental');--> statement-breakpoint
CREATE TABLE "backups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar(32),
	"label" varchar(160) NOT NULL,
	"kind" "backup_kind" DEFAULT 'full' NOT NULL,
	"status" "backup_job_status" DEFAULT 'pending' NOT NULL,
	"size_bytes" bigint DEFAULT 0 NOT NULL,
	"storage_key" varchar(512),
	"created_by" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "restore_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"backup_id" uuid NOT NULL,
	"status" "backup_job_status" DEFAULT 'pending' NOT NULL,
	"restored_by" varchar(128),
	"note" varchar(512),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "restore_history" ADD CONSTRAINT "restore_history_backup_id_backups_id_fk" FOREIGN KEY ("backup_id") REFERENCES "public"."backups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "backups_project_idx" ON "backups" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "backups_status_idx" ON "backups" USING btree ("status");--> statement-breakpoint
CREATE INDEX "backups_created_idx" ON "backups" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "restore_history_backup_idx" ON "restore_history" USING btree ("backup_id");--> statement-breakpoint
CREATE INDEX "restore_history_created_idx" ON "restore_history" USING btree ("created_at");