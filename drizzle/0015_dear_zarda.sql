CREATE TABLE "invoice_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
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
ALTER TABLE "invoice_attachments" ADD CONSTRAINT "invoice_attachments_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invoice_attachments_invoice_idx" ON "invoice_attachments" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "invoice_attachments_tenant_idx" ON "invoice_attachments" USING btree ("project_id","location_id");--> statement-breakpoint
CREATE INDEX "invoice_attachments_category_idx" ON "invoice_attachments" USING btree ("category");