CREATE TYPE "public"."daily_transaction_log_action" AS ENUM('create', 'edit', 'submit', 'approve', 'reject', 'lock', 'unlock');--> statement-breakpoint
CREATE TABLE "daily_transaction_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" uuid NOT NULL,
	"project_id" varchar(32) NOT NULL,
	"location_id" varchar(64) NOT NULL,
	"action" "daily_transaction_log_action" NOT NULL,
	"actor" varchar(128) NOT NULL,
	"from_status" varchar(32),
	"to_status" varchar(32),
	"detail" varchar(512),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "daily_transaction_logs" ADD CONSTRAINT "daily_transaction_logs_transaction_id_daily_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."daily_transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "daily_tx_log_tx_idx" ON "daily_transaction_logs" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "daily_tx_log_tenant_idx" ON "daily_transaction_logs" USING btree ("project_id","location_id");--> statement-breakpoint
CREATE INDEX "daily_tx_log_created_idx" ON "daily_transaction_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "daily_tx_log_action_idx" ON "daily_transaction_logs" USING btree ("action");