CREATE TYPE "public"."deadline_kind" AS ENUM('closing', 'invoice_submit', 'approval', 'payment', 'audit');--> statement-breakpoint
CREATE TYPE "public"."deadline_status" AS ENUM('on_track', 'due_soon', 'due_today', 'overdue', 'settled');--> statement-breakpoint
CREATE TABLE "deadlines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar(32) NOT NULL,
	"location_id" varchar(64) NOT NULL,
	"kind" "deadline_kind" NOT NULL,
	"title" varchar(160) NOT NULL,
	"target" varchar(160),
	"owner" varchar(128),
	"due_date" date NOT NULL,
	"status" "deadline_status" DEFAULT 'on_track' NOT NULL,
	"progress_pct" integer DEFAULT 0 NOT NULL,
	"created_by" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "deadlines_tenant_idx" ON "deadlines" USING btree ("project_id","location_id");--> statement-breakpoint
CREATE INDEX "deadlines_due_idx" ON "deadlines" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "deadlines_kind_idx" ON "deadlines" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "deadlines_status_idx" ON "deadlines" USING btree ("status");