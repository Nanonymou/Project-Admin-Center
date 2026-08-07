CREATE TYPE "public"."approval_action" AS ENUM('submit', 'approve', 'reject', 'return', 'reassign');--> statement-breakpoint
CREATE TYPE "public"."approval_status" AS ENUM('in_progress', 'approved', 'rejected', 'returned', 'completed');--> statement-breakpoint
CREATE TYPE "public"."approval_subject_type" AS ENUM('invoice', 'daily_closing');--> statement-breakpoint
CREATE TABLE "approval_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"approval_id" uuid NOT NULL,
	"project_id" varchar(32) NOT NULL,
	"location_id" varchar(64) NOT NULL,
	"from_stage" varchar(64),
	"to_stage" varchar(64) NOT NULL,
	"action" "approval_action" NOT NULL,
	"actor" varchar(128) NOT NULL,
	"note" varchar(512),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar(32) NOT NULL,
	"location_id" varchar(64) NOT NULL,
	"subject_type" "approval_subject_type" NOT NULL,
	"subject_id" varchar(64) NOT NULL,
	"current_stage" varchar(64) NOT NULL,
	"status" "approval_status" DEFAULT 'in_progress' NOT NULL,
	"assigned_to" varchar(128),
	"due_date" date,
	"created_by" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "approval_history" ADD CONSTRAINT "approval_history_approval_id_approvals_id_fk" FOREIGN KEY ("approval_id") REFERENCES "public"."approvals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "approval_history_approval_idx" ON "approval_history" USING btree ("approval_id");--> statement-breakpoint
CREATE INDEX "approval_history_tenant_idx" ON "approval_history" USING btree ("project_id","location_id");--> statement-breakpoint
CREATE INDEX "approval_history_created_idx" ON "approval_history" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "approvals_tenant_idx" ON "approvals" USING btree ("project_id","location_id");--> statement-breakpoint
CREATE INDEX "approvals_subject_idx" ON "approvals" USING btree ("subject_type","subject_id");--> statement-breakpoint
CREATE INDEX "approvals_status_idx" ON "approvals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "approvals_stage_idx" ON "approvals" USING btree ("current_stage");