CREATE TYPE "public"."dana_cash_audit_action" AS ENUM('create', 'update', 'delete');--> statement-breakpoint
CREATE TYPE "public"."dana_cash_direction" AS ENUM('top_up', 'expense');--> statement-breakpoint
CREATE TABLE "dana_cash_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" uuid NOT NULL,
	"project_id" varchar(32) NOT NULL,
	"location_id" varchar(64) NOT NULL,
	"file_name" varchar(256) NOT NULL,
	"file_type" varchar(128),
	"size_bytes" bigint DEFAULT 0 NOT NULL,
	"storage_key" varchar(512),
	"uploaded_by" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dana_cash_audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" uuid,
	"project_id" varchar(32) NOT NULL,
	"location_id" varchar(64) NOT NULL,
	"action" "dana_cash_audit_action" NOT NULL,
	"before_amount" numeric(18, 2),
	"after_amount" numeric(18, 2),
	"actor" varchar(128),
	"detail" varchar(512),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dana_cash_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar(32) NOT NULL,
	"location_id" varchar(64) NOT NULL,
	"trx_date" date NOT NULL,
	"direction" "dana_cash_direction" NOT NULL,
	"category_key" varchar(64),
	"description" varchar(512),
	"amount" numeric(18, 2) DEFAULT '0' NOT NULL,
	"performed_by" varchar(128),
	"created_by" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" varchar(128)
);
--> statement-breakpoint
ALTER TABLE "dana_cash_attachments" ADD CONSTRAINT "dana_cash_attachments_transaction_id_dana_cash_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."dana_cash_transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dana_cash_att_tx_idx" ON "dana_cash_attachments" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "dana_cash_att_tenant_idx" ON "dana_cash_attachments" USING btree ("project_id","location_id");--> statement-breakpoint
CREATE INDEX "dana_cash_audit_tx_idx" ON "dana_cash_audit" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "dana_cash_audit_tenant_idx" ON "dana_cash_audit" USING btree ("project_id","location_id");--> statement-breakpoint
CREATE INDEX "dana_cash_tx_tenant_idx" ON "dana_cash_transactions" USING btree ("project_id","location_id");--> statement-breakpoint
CREATE INDEX "dana_cash_tx_date_idx" ON "dana_cash_transactions" USING btree ("trx_date");--> statement-breakpoint
CREATE INDEX "dana_cash_tx_direction_idx" ON "dana_cash_transactions" USING btree ("direction");