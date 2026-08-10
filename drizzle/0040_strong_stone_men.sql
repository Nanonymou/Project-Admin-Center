CREATE TYPE "public"."evidence_status" AS ENUM('pending', 'verified', 'rejected');--> statement-breakpoint
CREATE TABLE "evidence_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar(32) NOT NULL,
	"location_id" varchar(64) NOT NULL,
	"kind" varchar(32) NOT NULL,
	"file_name" varchar(256) NOT NULL,
	"file_type" varchar(128),
	"size_bytes" bigint DEFAULT 0 NOT NULL,
	"storage_key" varchar(512),
	"status" "evidence_status" DEFAULT 'pending' NOT NULL,
	"reference" varchar(128),
	"note" varchar(512),
	"uploaded_by" varchar(128),
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" varchar(128)
);
--> statement-breakpoint
CREATE INDEX "evidence_attachments_tenant_idx" ON "evidence_attachments" USING btree ("project_id","location_id");--> statement-breakpoint
CREATE INDEX "evidence_attachments_kind_idx" ON "evidence_attachments" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "evidence_attachments_status_idx" ON "evidence_attachments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "evidence_attachments_ref_idx" ON "evidence_attachments" USING btree ("reference");