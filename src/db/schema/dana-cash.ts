import { relations } from "drizzle-orm";
import { bigint, date, index, numeric, pgEnum, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { tenancyColumns, auditColumns, softDeleteColumns } from "./columns";

/** Direction of a cash-fund movement. */
export const danaCashDirection = pgEnum("dana_cash_direction", ["top_up", "expense"]);

/** Action recorded in the Dana Cash audit trail. */
export const danaCashAuditAction = pgEnum("dana_cash_audit_action", ["create", "update", "delete"]);

/**
 * Dana Cash (petty-cash fund) transactions — the ledger behind the Daily Cost
 * Dana Cash page. Each row is a top-up (adds to the fund) or an expense
 * (subtracts), keyed by config-driven category. Tenant-scoped by
 * project_id/location_id, soft-deletable. The running balance is derived from
 * the ordered movements plus the fund's opening balance, so it is not stored.
 */
export const danaCashTransactions = pgTable(
  "dana_cash_transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ...tenancyColumns,
    trxDate: date("trx_date").notNull(),
    direction: danaCashDirection("direction").notNull(),
    categoryKey: varchar("category_key", { length: 64 }),
    description: varchar("description", { length: 512 }),
    /** Always stored positive; `direction` gives the sign. */
    amount: numeric("amount", { precision: 18, scale: 2 }).default("0").notNull(),
    performedBy: varchar("performed_by", { length: 128 }),
    ...auditColumns,
    ...softDeleteColumns,
  },
  (t) => ({
    tenantIdx: index("dana_cash_tx_tenant_idx").on(t.projectId, t.locationId),
    dateIdx: index("dana_cash_tx_date_idx").on(t.trxDate),
    directionIdx: index("dana_cash_tx_direction_idx").on(t.direction),
  }),
);

/**
 * Attachments (receipts / proof) for a Dana Cash transaction. FK-bound to the
 * transaction so a cash movement can carry its supporting document. Storage is
 * key-based (no binary in the DB).
 */
export const danaCashAttachments = pgTable(
  "dana_cash_attachments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    transactionId: uuid("transaction_id")
      .notNull()
      .references(() => danaCashTransactions.id, { onDelete: "cascade" }),
    ...tenancyColumns,
    fileName: varchar("file_name", { length: 256 }).notNull(),
    fileType: varchar("file_type", { length: 128 }),
    sizeBytes: bigint("size_bytes", { mode: "number" }).default(0).notNull(),
    storageKey: varchar("storage_key", { length: 512 }),
    uploadedBy: varchar("uploaded_by", { length: 128 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    txIdx: index("dana_cash_att_tx_idx").on(t.transactionId),
    tenantIdx: index("dana_cash_att_tenant_idx").on(t.projectId, t.locationId),
  }),
);

/**
 * Append-only audit trail for Dana Cash transactions — records create / update /
 * delete actions with the before / after amount so the cash-fund history is
 * fully auditable. Tenant-scoped; never updated after insert.
 */
export const danaCashAudit = pgTable(
  "dana_cash_audit",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    transactionId: uuid("transaction_id"),
    ...tenancyColumns,
    action: danaCashAuditAction("action").notNull(),
    beforeAmount: numeric("before_amount", { precision: 18, scale: 2 }),
    afterAmount: numeric("after_amount", { precision: 18, scale: 2 }),
    actor: varchar("actor", { length: 128 }),
    detail: varchar("detail", { length: 512 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    txIdx: index("dana_cash_audit_tx_idx").on(t.transactionId),
    tenantIdx: index("dana_cash_audit_tenant_idx").on(t.projectId, t.locationId),
  }),
);

export const danaCashTransactionsRelations = relations(danaCashTransactions, ({ many }) => ({
  attachments: many(danaCashAttachments),
}));

export const danaCashAttachmentsRelations = relations(danaCashAttachments, ({ one }) => ({
  transaction: one(danaCashTransactions, {
    fields: [danaCashAttachments.transactionId],
    references: [danaCashTransactions.id],
  }),
}));

export type DanaCashTransaction = typeof danaCashTransactions.$inferSelect;
export type NewDanaCashTransaction = typeof danaCashTransactions.$inferInsert;
export type DanaCashAttachment = typeof danaCashAttachments.$inferSelect;
export type NewDanaCashAttachment = typeof danaCashAttachments.$inferInsert;
export type DanaCashAudit = typeof danaCashAudit.$inferSelect;
export type NewDanaCashAudit = typeof danaCashAudit.$inferInsert;
