CREATE TABLE "master_taxes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_code" varchar(32),
	"code" varchar(32) NOT NULL,
	"label" varchar(128) NOT NULL,
	"rate" numeric(6, 4) DEFAULT '0' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_by" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "master_taxes_project_idx" ON "master_taxes" USING btree ("project_code");--> statement-breakpoint
CREATE INDEX "master_taxes_code_idx" ON "master_taxes" USING btree ("code");