DROP VIEW "public"."all_attachments";--> statement-breakpoint
CREATE VIEW "public"."all_attachments" AS (
    select "id", 'invoice' as "source", "invoice_id" as "entity_id", "project_id", "location_id",
      "category", "file_name", "file_type", "size_bytes", "storage_key", "uploaded_by", "created_at"
    from "invoice_attachments"
    union all
    select "id", 'transaction' as "source", "transaction_id" as "entity_id", "project_id", "location_id",
      "category", "file_name", "file_type", "size_bytes", "storage_key", "uploaded_by", "created_at"
    from "transaction_attachments"
    union all
    select "id", 'evidence' as "source", "id" as "entity_id", "project_id", "location_id",
      "kind" as "category", "file_name", "file_type", "size_bytes", "storage_key", "uploaded_by", "uploaded_at" as "created_at"
    from "evidence_attachments"
    where "deleted_at" is null
    union all
    select "id", 'dana_cash' as "source", "transaction_id" as "entity_id", "project_id", "location_id",
      null::varchar as "category", "file_name", "file_type", "size_bytes", "storage_key", "uploaded_by", "created_at"
    from "dana_cash_attachments"
  );