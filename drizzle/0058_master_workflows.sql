CREATE TABLE "master_workflows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_code" varchar(32) NOT NULL,
	"location_id" varchar(64) NOT NULL,
	"subject_type" varchar(32) NOT NULL,
	"code" varchar(64) NOT NULL,
	"name" varchar(128) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_by" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_id" uuid NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL,
	"name" varchar(128) NOT NULL,
	"sla_days" integer DEFAULT 0 NOT NULL,
	"pic" varchar(64),
	"created_by" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workflow_activities" ADD CONSTRAINT "workflow_activities_workflow_id_master_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."master_workflows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "master_workflows_key_idx" ON "master_workflows" USING btree ("location_id","subject_type");--> statement-breakpoint
CREATE INDEX "master_workflows_project_idx" ON "master_workflows" USING btree ("project_code");--> statement-breakpoint
CREATE INDEX "workflow_activities_workflow_idx" ON "workflow_activities" USING btree ("workflow_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_activities_order_idx" ON "workflow_activities" USING btree ("workflow_id","order_index");