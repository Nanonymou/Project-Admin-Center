import { sql } from "drizzle-orm";
import { bigint, pgView, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

/**
 * Unified attachment feed for the Attachment Center & Pratinjau Lampiran
 * (attachment preview) — a UNION of every uploaded-file source in the app
 * (invoice, daily-transaction, evidence, and dana-cash attachments) normalized
 * into one shape and tagged with a `source`. `storage_key` is exposed so the
 * preview screen can resolve preview/download URLs from a single view without
 * duplicating storage. Soft-deleted evidence rows are excluded.
 */
export const allAttachments = pgView("all_attachments", {
  id: uuid("id"),
  source: varchar("source", { length: 16 }),
  entityId: uuid("entity_id"),
  projectId: varchar("project_id", { length: 32 }),
  locationId: varchar("location_id", { length: 64 }),
  category: varchar("category", { length: 64 }),
  fileName: varchar("file_name", { length: 256 }),
  fileType: varchar("file_type", { length: 128 }),
  sizeBytes: bigint("size_bytes", { mode: "number" }),
  storageKey: varchar("storage_key", { length: 512 }),
  uploadedBy: varchar("uploaded_by", { length: 128 }),
  createdAt: timestamp("created_at", { withTimezone: true }),
}).as(
  sql`
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
  `,
);

export type AllAttachmentRow = typeof allAttachments.$inferSelect;
