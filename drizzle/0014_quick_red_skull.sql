CREATE TABLE "lock_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar(32) NOT NULL,
	"location_id" varchar(64) NOT NULL,
	"period_label" varchar(64) NOT NULL,
	"period_start" date,
	"period_end" date,
	"locked" boolean DEFAULT false NOT NULL,
	"locked_by" varchar(128),
	"locked_at" timestamp with time zone,
	"reason" varchar(512),
	"created_by" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "lock_periods_period_idx" ON "lock_periods" USING btree ("project_id","location_id","period_label");--> statement-breakpoint
CREATE INDEX "lock_periods_tenant_idx" ON "lock_periods" USING btree ("project_id","location_id");--> statement-breakpoint
CREATE INDEX "lock_periods_locked_idx" ON "lock_periods" USING btree ("locked");