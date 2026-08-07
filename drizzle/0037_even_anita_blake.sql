CREATE TYPE "public"."import_export_direction" AS ENUM('import', 'export');--> statement-breakpoint
CREATE TYPE "public"."import_export_status" AS ENUM('pending', 'running', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "import_export_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"direction" "import_export_direction" NOT NULL,
	"entity" varchar(48) NOT NULL,
	"project_id" varchar(32),
	"format" varchar(16) DEFAULT 'csv' NOT NULL,
	"status" "import_export_status" DEFAULT 'pending' NOT NULL,
	"total_rows" integer DEFAULT 0 NOT NULL,
	"processed_rows" integer DEFAULT 0 NOT NULL,
	"failed_rows" integer DEFAULT 0 NOT NULL,
	"actor" varchar(128),
	"detail" varchar(512),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "import_export_jobs_direction_idx" ON "import_export_jobs" USING btree ("direction");--> statement-breakpoint
CREATE INDEX "import_export_jobs_entity_idx" ON "import_export_jobs" USING btree ("entity");--> statement-breakpoint
CREATE INDEX "import_export_jobs_project_idx" ON "import_export_jobs" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "import_export_jobs_created_idx" ON "import_export_jobs" USING btree ("created_at");