CREATE TYPE "public"."daily_transaction_kind" AS ENUM('sales', 'cost');--> statement-breakpoint
CREATE TYPE "public"."daily_transaction_status" AS ENUM('draft', 'submitted', 'approved', 'locked');--> statement-breakpoint
CREATE TABLE "daily_transaction_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" uuid NOT NULL,
	"project_id" varchar(32) NOT NULL,
	"location_id" varchar(64) NOT NULL,
	"category_key" varchar(64) NOT NULL,
	"label" varchar(128) NOT NULL,
	"qty" numeric(18, 3) DEFAULT '0' NOT NULL,
	"unit_price" numeric(18, 2) DEFAULT '0' NOT NULL,
	"amount" numeric(18, 2) DEFAULT '0' NOT NULL,
	"is_deduction" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar(32) NOT NULL,
	"location_id" varchar(64) NOT NULL,
	"kind" "daily_transaction_kind" NOT NULL,
	"trx_date" date NOT NULL,
	"area" varchar(128),
	"status" "daily_transaction_status" DEFAULT 'draft' NOT NULL,
	"subtotal" numeric(18, 2) DEFAULT '0' NOT NULL,
	"tax" numeric(18, 2) DEFAULT '0' NOT NULL,
	"total" numeric(18, 2) DEFAULT '0' NOT NULL,
	"created_by" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "daily_transaction_lines" ADD CONSTRAINT "daily_transaction_lines_transaction_id_daily_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."daily_transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "daily_tx_line_tx_idx" ON "daily_transaction_lines" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "daily_tx_line_tenant_idx" ON "daily_transaction_lines" USING btree ("project_id","location_id");--> statement-breakpoint
CREATE INDEX "daily_tx_tenant_idx" ON "daily_transactions" USING btree ("project_id","location_id");--> statement-breakpoint
CREATE INDEX "daily_tx_date_idx" ON "daily_transactions" USING btree ("trx_date");--> statement-breakpoint
CREATE INDEX "daily_tx_kind_idx" ON "daily_transactions" USING btree ("kind");