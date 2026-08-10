import { relations } from "drizzle-orm";
import { bigint, index, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { tenancyColumns } from "./columns";
import { invoices } from "./invoices";

/**
 * Invoice attachments (lampiran) — supporting documents for an invoice such as
 * the berita acara, quantity recap, or tax faktur. Tenant-scoped by
 * project_id/location_id and linked to the invoice by FK. `category` is a
 * config-driven document type key; `storageKey` points at the stored file. The
 * invoice audit trail itself lives in the generic invoice_activities table.
 */
export const invoiceAttachments = pgTable(
  "invoice_attachments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    ...tenancyColumns,
    category: varchar("category", { length: 64 }),
    // Workflow stage this document belongs to (config-driven stage key), so the
    // Detail Invoice can group supporting documents by approval stage.
    stage: varchar("stage", { length: 64 }),
    fileName: varchar("file_name", { length: 256 }).notNull(),
    fileType: varchar("file_type", { length: 128 }),
    sizeBytes: bigint("size_bytes", { mode: "number" }).default(0).notNull(),
    storageKey: varchar("storage_key", { length: 512 }),
    // Free-text caption shown alongside the document in the attachment center.
    note: varchar("note", { length: 512 }),
    uploadedBy: varchar("uploaded_by", { length: 128 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    invoiceIdx: index("invoice_attachments_invoice_idx").on(t.invoiceId),
    tenantIdx: index("invoice_attachments_tenant_idx").on(t.projectId, t.locationId),
    categoryIdx: index("invoice_attachments_category_idx").on(t.category),
    stageIdx: index("invoice_attachments_stage_idx").on(t.invoiceId, t.stage),
  }),
);

export const invoiceAttachmentsRelations = relations(invoiceAttachments, ({ one }) => ({
  invoice: one(invoices, {
    fields: [invoiceAttachments.invoiceId],
    references: [invoices.id],
  }),
}));

export type InvoiceAttachment = typeof invoiceAttachments.$inferSelect;
export type NewInvoiceAttachment = typeof invoiceAttachments.$inferInsert;
