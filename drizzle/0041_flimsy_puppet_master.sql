ALTER TYPE "public"."daily_transaction_log_action" ADD VALUE 'copy';--> statement-breakpoint
ALTER TABLE "daily_transactions" ADD COLUMN "copied_from_id" uuid;