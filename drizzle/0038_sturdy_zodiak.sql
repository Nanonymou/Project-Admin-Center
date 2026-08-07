CREATE TABLE "sla_targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_code" varchar(32) NOT NULL,
	"subject_type" "approval_subject_type" NOT NULL,
	"target_days" integer DEFAULT 0 NOT NULL,
	"at_risk_pct" integer DEFAULT 80 NOT NULL,
	"breach_grace_days" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_by" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "sla_targets_key_idx" ON "sla_targets" USING btree ("project_code","subject_type");--> statement-breakpoint
CREATE INDEX "sla_targets_project_idx" ON "sla_targets" USING btree ("project_code");