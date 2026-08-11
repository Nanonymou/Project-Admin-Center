ALTER TABLE "master_timeframes" ADD COLUMN "role" varchar(64);--> statement-breakpoint
ALTER TABLE "master_timeframes" ADD COLUMN "stage_type" varchar(32);--> statement-breakpoint
ALTER TABLE "master_timeframes" ADD COLUMN "requires_document" boolean DEFAULT false NOT NULL;