CREATE TABLE "cost_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar(32) NOT NULL,
	"location_id" varchar(64) NOT NULL,
	"batch_id" uuid,
	"category_key" varchar(64) NOT NULL,
	"label" varchar(128) NOT NULL,
	"qty" numeric(18, 2) DEFAULT '0' NOT NULL,
	"unit_price" numeric(18, 2) DEFAULT '0' NOT NULL,
	"amount" numeric(18, 2) DEFAULT '0' NOT NULL,
	"note" varchar(512),
	"created_by" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" varchar(128)
);
--> statement-breakpoint
CREATE INDEX "cost_items_tenant_idx" ON "cost_items" USING btree ("project_id","location_id");--> statement-breakpoint
CREATE INDEX "cost_items_batch_idx" ON "cost_items" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "cost_items_category_idx" ON "cost_items" USING btree ("category_key");