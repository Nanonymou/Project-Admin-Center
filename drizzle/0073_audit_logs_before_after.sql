ALTER TABLE "audit_logs" ADD COLUMN "before_value" varchar(512);--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "after_value" varchar(512);