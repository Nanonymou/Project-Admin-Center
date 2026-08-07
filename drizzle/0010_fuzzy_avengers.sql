CREATE TABLE "master_areas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar(32) NOT NULL,
	"location_id" varchar(64) NOT NULL,
	"area_code" varchar(64) NOT NULL,
	"name" varchar(160) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_by" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "master_areas_code_idx" ON "master_areas" USING btree ("project_id","location_id","area_code");--> statement-breakpoint
CREATE INDEX "master_areas_tenant_idx" ON "master_areas" USING btree ("project_id","location_id");