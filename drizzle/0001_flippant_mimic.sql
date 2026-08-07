CREATE TYPE "public"."invoice_aging_bucket" AS ENUM('0-30', '31-60', '61-90', '>90');--> statement-breakpoint
CREATE TYPE "public"."invoice_stage" AS ENUM('Verifikasi Site', 'Approval Leader', 'Verifikasi Finance', 'Kirim Client', 'Payment');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('on_time', 'at_risk', 'overdue', 'settled');--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar(32) NOT NULL,
	"location_id" varchar(64) NOT NULL,
	"number" varchar(64) NOT NULL,
	"subtotal" numeric(18, 2) DEFAULT '0' NOT NULL,
	"deduction" numeric(18, 2) DEFAULT '0' NOT NULL,
	"tax" numeric(18, 2) DEFAULT '0' NOT NULL,
	"amount" numeric(18, 2) DEFAULT '0' NOT NULL,
	"status" "invoice_status" DEFAULT 'on_time' NOT NULL,
	"stage" "invoice_stage" DEFAULT 'Verifikasi Site' NOT NULL,
	"aging_bucket" "invoice_aging_bucket" DEFAULT '0-30' NOT NULL,
	"issued_date" date,
	"due_date" date,
	"pic" varchar(128),
	"created_by" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_number_idx" ON "invoices" USING btree ("number");--> statement-breakpoint
CREATE INDEX "invoices_tenant_idx" ON "invoices" USING btree ("project_id","location_id");--> statement-breakpoint
CREATE INDEX "invoices_status_idx" ON "invoices" USING btree ("status");--> statement-breakpoint
CREATE INDEX "invoices_stage_idx" ON "invoices" USING btree ("stage");--> statement-breakpoint
CREATE INDEX "invoices_due_idx" ON "invoices" USING btree ("due_date");