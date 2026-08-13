CREATE TABLE "formula_parameter_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_code" varchar(32) NOT NULL,
	"key" varchar(96) NOT NULL,
	"label" varchar(160) DEFAULT '' NOT NULL,
	"action" varchar(16) NOT NULL,
	"before_value" varchar(64),
	"after_value" varchar(64),
	"changed_by" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "formula_parameters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_code" varchar(32) NOT NULL,
	"key" varchar(96) NOT NULL,
	"label" varchar(160) NOT NULL,
	"group" varchar(64) DEFAULT '' NOT NULL,
	"type" varchar(16) NOT NULL,
	"value" numeric(18, 4) DEFAULT '0' NOT NULL,
	"builtin" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_by" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "formula_parameter_history_project_idx" ON "formula_parameter_history" USING btree ("project_code");--> statement-breakpoint
CREATE INDEX "formula_parameter_history_key_idx" ON "formula_parameter_history" USING btree ("key");--> statement-breakpoint
CREATE UNIQUE INDEX "formula_parameters_key_idx" ON "formula_parameters" USING btree ("project_code","key");--> statement-breakpoint
CREATE INDEX "formula_parameters_project_idx" ON "formula_parameters" USING btree ("project_code");