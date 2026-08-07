CREATE TYPE "public"."invoice_activity_action" AS ENUM('create', 'edit', 'submit', 'review', 'approve', 'reject', 'lock', 'unlock', 'upload', 'send', 'comment', 'remind');--> statement-breakpoint
CREATE TABLE "invoice_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"project_id" varchar(32) NOT NULL,
	"location_id" varchar(64) NOT NULL,
	"action" "invoice_activity_action" NOT NULL,
	"actor" varchar(128) NOT NULL,
	"role" varchar(64),
	"from_stage" varchar(64),
	"to_stage" varchar(64),
	"detail" varchar(512),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "invoice_activities" ADD CONSTRAINT "invoice_activities_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invoice_activities_invoice_idx" ON "invoice_activities" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "invoice_activities_tenant_idx" ON "invoice_activities" USING btree ("project_id","location_id");--> statement-breakpoint
CREATE INDEX "invoice_activities_created_idx" ON "invoice_activities" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "invoice_activities_action_idx" ON "invoice_activities" USING btree ("action");