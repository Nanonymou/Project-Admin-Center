CREATE TABLE "master_timeframes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_code" varchar(32) NOT NULL,
	"subject_type" varchar(32) NOT NULL,
	"stage" varchar(64) NOT NULL,
	"sla_days" integer DEFAULT 0 NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_by" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "master_timeframes_key_idx" ON "master_timeframes" USING btree ("project_code","subject_type","stage");--> statement-breakpoint
CREATE INDEX "master_timeframes_project_idx" ON "master_timeframes" USING btree ("project_code");