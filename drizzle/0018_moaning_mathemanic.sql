CREATE TABLE "transaction_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" uuid NOT NULL,
	"project_id" varchar(32) NOT NULL,
	"location_id" varchar(64) NOT NULL,
	"category" varchar(64),
	"file_name" varchar(256) NOT NULL,
	"file_type" varchar(128),
	"size_bytes" bigint DEFAULT 0 NOT NULL,
	"storage_key" varchar(512),
	"uploaded_by" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "transaction_attachments" ADD CONSTRAINT "transaction_attachments_transaction_id_daily_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."daily_transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "transaction_attachments_tx_idx" ON "transaction_attachments" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "transaction_attachments_tenant_idx" ON "transaction_attachments" USING btree ("project_id","location_id");