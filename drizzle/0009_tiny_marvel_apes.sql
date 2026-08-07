CREATE TYPE "public"."master_category_kind" AS ENUM('sales', 'cost');--> statement-breakpoint
CREATE TABLE "master_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_code" varchar(32) NOT NULL,
	"kind" "master_category_kind" NOT NULL,
	"category_key" varchar(64) NOT NULL,
	"label" varchar(128) NOT NULL,
	"sub_category" varchar(64),
	"unit" varchar(32),
	"default_price" numeric(18, 2) DEFAULT '0' NOT NULL,
	"is_deduction" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_by" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "master_categories_key_idx" ON "master_categories" USING btree ("project_code","kind","category_key");--> statement-breakpoint
CREATE INDEX "master_categories_project_idx" ON "master_categories" USING btree ("project_code");