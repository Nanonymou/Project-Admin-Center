import { index, numeric, pgEnum, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { tenancyColumns } from "./columns";

/** Which side of the ledger a change-history row belongs to. */
export const entryChangeKind = pgEnum("entry_change_kind", ["sales", "cost"]);

/** The kind of change recorded. */
export const entryChangeAction = pgEnum("entry_change_action", ["create", "update", "delete"]);

/**
 * Field-level change history for daily entries — the append-only trail behind
 * the "Riwayat Perubahan Pengeluaran" and "Riwayat Perubahan Penjualan" pages.
 * One generic table serves both sides via `kind`, so cost and sales share the
 * same audit surface without any project- or side-named table. Each row captures
 * the changed `field` with its numeric `before_value` / `after_value` (null when
 * not applicable, e.g. a create has no before) plus who changed it and why.
 * Tenant-scoped by project_id/location_id.
 */
export const entryChangeHistory = pgTable(
  "entry_change_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ...tenancyColumns,
    kind: entryChangeKind("kind").notNull(),
    transactionId: uuid("transaction_id"),
    trxDate: varchar("trx_date", { length: 10 }).notNull(),
    categoryKey: varchar("category_key", { length: 64 }),
    action: entryChangeAction("action").notNull(),
    field: varchar("field", { length: 64 }).notNull(),
    beforeValue: numeric("before_value", { precision: 18, scale: 2 }),
    afterValue: numeric("after_value", { precision: 18, scale: 2 }),
    editor: varchar("editor", { length: 128 }),
    reason: varchar("reason", { length: 512 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    tenantIdx: index("entry_change_history_tenant_idx").on(t.projectId, t.locationId),
    kindIdx: index("entry_change_history_kind_idx").on(t.kind),
    txIdx: index("entry_change_history_tx_idx").on(t.transactionId),
    dateIdx: index("entry_change_history_date_idx").on(t.trxDate),
  }),
);

export type EntryChangeHistory = typeof entryChangeHistory.$inferSelect;
export type NewEntryChangeHistory = typeof entryChangeHistory.$inferInsert;
