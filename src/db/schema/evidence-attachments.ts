import { bigint, index, pgEnum, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { tenancyColumns, auditColumns, softDeleteColumns } from "./columns";

/** Review lifecycle of an uploaded evidence file. */
export const evidenceStatus = pgEnum("evidence_status", ["pending", "verified", "rejected"]);

/**
 * Evidence ("bukti") attachments — the standalone document store behind the
 * Upload Bukti center. Unlike `transaction_attachments` / `invoice_attachments`
 * (which are FK-bound to a single entry), an evidence row is a self-contained
 * proof classified by `kind` (payment / invoice / delivery / receipt / cost) and
 * moves through a review `status`. Generic and tenant-scoped by
 * project_id/location_id; the optional `reference` links it loosely to a
 * business object without a hard FK. Soft-deletable so removals go to the
 * recycle bin.
 */
export const evidenceAttachments = pgTable(
  "evidence_attachments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ...tenancyColumns,
    kind: varchar("kind", { length: 32 }).notNull(),
    fileName: varchar("file_name", { length: 256 }).notNull(),
    fileType: varchar("file_type", { length: 128 }),
    sizeBytes: bigint("size_bytes", { mode: "number" }).default(0).notNull(),
    storageKey: varchar("storage_key", { length: 512 }),
    status: evidenceStatus("status").default("pending").notNull(),
    reference: varchar("reference", { length: 128 }),
    note: varchar("note", { length: 512 }),
    uploadedBy: varchar("uploaded_by", { length: 128 }),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true }).defaultNow().notNull(),
    ...auditColumns,
    ...softDeleteColumns,
  },
  (t) => ({
    tenantIdx: index("evidence_attachments_tenant_idx").on(t.projectId, t.locationId),
    kindIdx: index("evidence_attachments_kind_idx").on(t.kind),
    statusIdx: index("evidence_attachments_status_idx").on(t.status),
    refIdx: index("evidence_attachments_ref_idx").on(t.reference),
  }),
);

export type EvidenceAttachment = typeof evidenceAttachments.$inferSelect;
export type NewEvidenceAttachment = typeof evidenceAttachments.$inferInsert;
