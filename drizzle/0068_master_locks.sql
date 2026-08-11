CREATE TABLE "master_locks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_key" varchar(48) NOT NULL,
	"label" varchar(128) NOT NULL,
	"category" varchar(48) DEFAULT '' NOT NULL,
	"locked" boolean DEFAULT false NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"last_modified_by" varchar(128),
	"last_modified_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "master_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_key" varchar(48) NOT NULL,
	"version" integer NOT NULL,
	"changed_by" varchar(128),
	"summary" varchar(512) DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "master_locks_entity_idx" ON "master_locks" USING btree ("entity_key");--> statement-breakpoint
CREATE INDEX "master_locks_category_idx" ON "master_locks" USING btree ("category");--> statement-breakpoint
CREATE INDEX "master_versions_entity_idx" ON "master_versions" USING btree ("entity_key");--> statement-breakpoint
CREATE UNIQUE INDEX "master_versions_entity_version_idx" ON "master_versions" USING btree ("entity_key","version");