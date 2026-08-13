CREATE TABLE "invoice_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_code" varchar(32),
	"code" varchar(64) NOT NULL,
	"label" varchar(128) NOT NULL,
	"deduction_rate" numeric(6, 4) DEFAULT '0' NOT NULL,
	"has_bbm" boolean DEFAULT false NOT NULL,
	"bbm_rate" numeric(6, 4) DEFAULT '0' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_by" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "invoice_types_code_idx" ON "invoice_types" USING btree ("code");--> statement-breakpoint
CREATE INDEX "invoice_types_project_idx" ON "invoice_types" USING btree ("project_code");