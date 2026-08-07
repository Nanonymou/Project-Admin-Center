import { sql } from "drizzle-orm";
import { bigint, pgView, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

/**
 * Unified attachment feed for the Attachment Center — a UNION of invoice
 * attachments and daily-transaction attachments into one shape, tagged with a
 * `source`. Lets the Attachment Center list and preview every uploaded file
 * across the app from a single view without duplicating storage.
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
  uploadedBy: varchar("uploaded_by", { length: 128 }),
  createdAt: timestamp("created_at", { withTimezone: true }),
}).as(
  sql`
    select "id", 'invoice' as "source", "invoice_id" as "entity_id", "project_id", "location_id",
      "category", "file_name", "file_type", "size_bytes", "uploaded_by", "created_at"
    from "invoice_attachments"
    union all
    select "id", 'transaction' as "source", "transaction_id" as "entity_id", "project_id", "location_id",
      "category", "file_name", "file_type", "size_bytes", "uploaded_by", "created_at"
    from "transaction_attachments"
  `,
);

export type AllAttachmentRow = typeof allAttachments.$inferSelect;
