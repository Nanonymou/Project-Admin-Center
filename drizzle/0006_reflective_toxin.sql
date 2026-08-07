ALTER TABLE "daily_transactions" ADD COLUMN "submitted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "daily_transactions" ADD COLUMN "submitted_by" varchar(128);--> statement-breakpoint
ALTER TABLE "daily_transactions" ADD COLUMN "approved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "daily_transactions" ADD COLUMN "approved_by" varchar(128);--> statement-breakpoint
ALTER TABLE "daily_transactions" ADD COLUMN "locked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "daily_transactions" ADD COLUMN "is_late" boolean DEFAULT false NOT NULL;