CREATE TABLE "meal_price_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_code" varchar(32) NOT NULL,
	"location_id" varchar(64) NOT NULL,
	"category_key" varchar(64) NOT NULL,
	"category_label" varchar(128) NOT NULL,
	"action" varchar(16) NOT NULL,
	"before_price" numeric(18, 2),
	"after_price" numeric(18, 2),
	"changed_by" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "meal_price_history_site_idx" ON "meal_price_history" USING btree ("project_code","location_id");--> statement-breakpoint
CREATE INDEX "meal_price_history_category_idx" ON "meal_price_history" USING btree ("location_id","category_key");