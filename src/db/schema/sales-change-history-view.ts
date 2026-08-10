import { sql } from "drizzle-orm";
import { numeric, pgView, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

/**
 * Sales change-history view — the `entry_change_history` rows for the sales side
 * only, giving the "Riwayat Perubahan Penjualan" page a dedicated read surface
 * without a separate table (the generic `entry_change_history` already stores
 * both sides via its `kind` discriminator). Keeps the app DRY: one source of
 * truth, one view per consumer.
 */
export const salesChangeHistory = pgView("sales_change_history", {
  id: uuid("id"),
  projectId: varchar("project_id", { length: 32 }),
  locationId: varchar("location_id", { length: 64 }),
  transactionId: uuid("transaction_id"),
  trxDate: varchar("trx_date", { length: 10 }),
  categoryKey: varchar("category_key", { length: 64 }),
  action: varchar("action", { length: 16 }),
  field: varchar("field", { length: 64 }),
  beforeValue: numeric("before_value", { precision: 18, scale: 2 }),
  afterValue: numeric("after_value", { precision: 18, scale: 2 }),
  editor: varchar("editor", { length: 128 }),
  reason: varchar("reason", { length: 512 }),
  createdAt: timestamp("created_at", { withTimezone: true }),
}).as(
  sql`
    select "id", "project_id", "location_id", "transaction_id", "trx_date", "category_key",
      "action", "field", "before_value", "after_value", "editor", "reason", "created_at"
    from "entry_change_history"
    where "kind" = 'sales'
  `,
);

export type SalesChangeHistoryRow = typeof salesChangeHistory.$inferSelect;
