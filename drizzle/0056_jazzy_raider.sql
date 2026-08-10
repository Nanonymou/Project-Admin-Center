CREATE TYPE "public"."stage_progress_state" AS ENUM('pending', 'current', 'done');--> statement-breakpoint
CREATE TABLE "invoice_stage_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"project_id" varchar(32) NOT NULL,
	"location_id" varchar(64) NOT NULL,
	"stage" varchar(64) NOT NULL,
	"stage_order" integer DEFAULT 0 NOT NULL,
	"sla_days" integer DEFAULT 0 NOT NULL,
	"state" "stage_progress_state" DEFAULT 'pending' NOT NULL,
	"started_at" date,
	"completed_at" date,
	"actual_days" integer DEFAULT 0 NOT NULL,
	"breached" boolean DEFAULT false NOT NULL,
	"pic" varchar(128),
	"doc_count" integer DEFAULT 0 NOT NULL,
	"created_by" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" varchar(128)
);
--> statement-breakpoint
ALTER TABLE "invoice_stage_progress" ADD CONSTRAINT "invoice_stage_progress_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invoice_stage_progress_invoice_idx" ON "invoice_stage_progress" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "invoice_stage_progress_tenant_idx" ON "invoice_stage_progress" USING btree ("project_id","location_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoice_stage_progress_stage_unique_idx" ON "invoice_stage_progress" USING btree ("invoice_id","stage");--> statement-breakpoint
CREATE INDEX "invoice_stage_progress_order_idx" ON "invoice_stage_progress" USING btree ("invoice_id","stage_order");--> statement-breakpoint
CREATE INDEX "invoice_stage_progress_breach_idx" ON "invoice_stage_progress" USING btree ("project_id","location_id","breached");