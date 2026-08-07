CREATE VIEW "public"."all_attachments" AS (
    select "id", 'invoice' as "source", "invoice_id" as "entity_id", "project_id", "location_id",
      "category", "file_name", "file_type", "size_bytes", "uploaded_by", "created_at"
    from "invoice_attachments"
    union all
    select "id", 'transaction' as "source", "transaction_id" as "entity_id", "project_id", "location_id",
      "category", "file_name", "file_type", "size_bytes", "uploaded_by", "created_at"
    from "transaction_attachments"
  );