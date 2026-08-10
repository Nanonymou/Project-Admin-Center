ALTER TABLE "invoice_attachments" ADD COLUMN "stage" varchar(64);--> statement-breakpoint
ALTER TABLE "invoice_attachments" ADD COLUMN "note" varchar(512);--> statement-breakpoint
CREATE INDEX "invoice_attachments_stage_idx" ON "invoice_attachments" USING btree ("invoice_id","stage");