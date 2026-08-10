CREATE TABLE "master_prices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_code" varchar(32) NOT NULL,
	"location_id" varchar(64) NOT NULL,
	"category_key" varchar(64) NOT NULL,
	"price" numeric(18, 2) DEFAULT '0' NOT NULL,
	"effective_from" varchar(7),
	"active" boolean DEFAULT true NOT NULL,
	"created_by" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "master_prices_key_idx" ON "master_prices" USING btree ("project_code","location_id","category_key");--> statement-breakpoint
CREATE INDEX "master_prices_project_idx" ON "master_prices" USING btree ("project_code");--> statement-breakpoint
CREATE INDEX "master_prices_location_idx" ON "master_prices" USING btree ("location_id");