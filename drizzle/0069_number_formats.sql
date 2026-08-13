CREATE TABLE "number_formats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(48) NOT NULL,
	"doc_type" varchar(48) NOT NULL,
	"label" varchar(128) NOT NULL,
	"prefix" varchar(16) DEFAULT '' NOT NULL,
	"pattern" varchar(128) NOT NULL,
	"seq_padding" integer DEFAULT 4 NOT NULL,
	"reset_period" varchar(16) DEFAULT 'yearly' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_by" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "number_sequences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"doc_type" varchar(48) NOT NULL,
	"period_key" varchar(16) NOT NULL,
	"next_seq" integer DEFAULT 1 NOT NULL,
	"created_by" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "number_formats_key_idx" ON "number_formats" USING btree ("key");--> statement-breakpoint
CREATE UNIQUE INDEX "number_sequences_bucket_idx" ON "number_sequences" USING btree ("doc_type","period_key");