ALTER TABLE "invoice_activities" ADD COLUMN "metadata" jsonb;--> statement-breakpoint
ALTER TABLE "invoice_activities" ADD COLUMN "ip_address" varchar(64);--> statement-breakpoint
ALTER TABLE "invoice_activities" ADD COLUMN "user_agent" varchar(256);