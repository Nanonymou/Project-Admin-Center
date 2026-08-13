CREATE TABLE "customer_vendors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(48) NOT NULL,
	"name" varchar(192) NOT NULL,
	"type" varchar(16) NOT NULL,
	"category" varchar(96) DEFAULT '' NOT NULL,
	"contact_person" varchar(128) DEFAULT '' NOT NULL,
	"phone" varchar(48) DEFAULT '' NOT NULL,
	"email" varchar(160) DEFAULT '' NOT NULL,
	"city" varchar(96) DEFAULT '' NOT NULL,
	"npwp" varchar(32) DEFAULT '' NOT NULL,
	"address" varchar(256) DEFAULT '' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_by" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "customer_vendors_code_idx" ON "customer_vendors" USING btree ("code");--> statement-breakpoint
CREATE INDEX "customer_vendors_type_idx" ON "customer_vendors" USING btree ("type");