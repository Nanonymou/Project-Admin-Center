CREATE TYPE "public"."entry_change_action" AS ENUM('create', 'update', 'delete');--> statement-breakpoint
CREATE TYPE "public"."entry_change_kind" AS ENUM('sales', 'cost');--> statement-breakpoint
CREATE TABLE "entry_change_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar(32) NOT NULL,
	"location_id" varchar(64) NOT NULL,
	"kind" "entry_change_kind" NOT NULL,
	"transaction_id" uuid,
	"trx_date" varchar(10) NOT NULL,
	"category_key" varchar(64),
	"action" "entry_change_action" NOT NULL,
	"field" varchar(64) NOT NULL,
	"before_value" numeric(18, 2),
	"after_value" numeric(18, 2),
	"editor" varchar(128),
	"reason" varchar(512),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "entry_change_history_tenant_idx" ON "entry_change_history" USING btree ("project_id","location_id");--> statement-breakpoint
CREATE INDEX "entry_change_history_kind_idx" ON "entry_change_history" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "entry_change_history_tx_idx" ON "entry_change_history" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "entry_change_history_date_idx" ON "entry_change_history" USING btree ("trx_date");