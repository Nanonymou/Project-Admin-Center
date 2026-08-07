import { relations } from "drizzle-orm";
import { bigint, index, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { tenancyColumns } from "./columns";
import { dailyTransactions } from "./daily-transactions";

/**
 * Attachments for daily transactions — supporting documents / proof for a daily
 * sales or cost entry (e.g. food-cost receipts, cash-advance proof). Generic:
 * the same table serves both kinds. Tenant-scoped by project_id/location_id and
 * linked to the transaction by FK. `category` mirrors the line category_key the
 * proof belongs to; `storageKey` points at the stored file.
 */
export const transactionAttachments = pgTable(
  "transaction_attachments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    transactionId: uuid("transaction_id")
      .notNull()
      .references(() => dailyTransactions.id, { onDelete: "cascade" }),
    ...tenancyColumns,
    category: varchar("category", { length: 64 }),
    fileName: varchar("file_name", { length: 256 }).notNull(),
    fileType: varchar("file_type", { length: 128 }),
    sizeBytes: bigint("size_bytes", { mode: "number" }).default(0).notNull(),
    storageKey: varchar("storage_key", { length: 512 }),
    uploadedBy: varchar("uploaded_by", { length: 128 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    txIdx: index("transaction_attachments_tx_idx").on(t.transactionId),
    tenantIdx: index("transaction_attachments_tenant_idx").on(t.projectId, t.locationId),
  }),
);

export const transactionAttachmentsRelations = relations(transactionAttachments, ({ one }) => ({
  transaction: one(dailyTransactions, {
    fields: [transactionAttachments.transactionId],
    references: [dailyTransactions.id],
  }),
}));

export type TransactionAttachment = typeof transactionAttachments.$inferSelect;
export type NewTransactionAttachment = typeof transactionAttachments.$inferInsert;
