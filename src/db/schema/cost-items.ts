import { index, numeric, pgTable, uuid, varchar } from "drizzle-orm/pg-core";
import { tenancyColumns, auditColumns, softDeleteColumns } from "./columns";

/**
 * Cost items behind the "Total Otomatis" cost calculator. Each row is one line
 * of a cost computation — category, quantity, unit price and the derived amount
 * (qty × unit_price). Rows sharing a `batch_id` form one calculation; `batch_id`
 * is a plain grouping key (no separate header table) so a batch's total is just
 * the sum of its items. Generic and tenant-scoped by project_id/location_id;
 * config-driven category keys, soft-deletable.
 */
export const costItems = pgTable(
  "cost_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ...tenancyColumns,
    batchId: uuid("batch_id"),
    categoryKey: varchar("category_key", { length: 64 }).notNull(),
    label: varchar("label", { length: 128 }).notNull(),
    qty: numeric("qty", { precision: 18, scale: 2 }).default("0").notNull(),
    unitPrice: numeric("unit_price", { precision: 18, scale: 2 }).default("0").notNull(),
    amount: numeric("amount", { precision: 18, scale: 2 }).default("0").notNull(),
    note: varchar("note", { length: 512 }),
    ...auditColumns,
    ...softDeleteColumns,
  },
  (t) => ({
    tenantIdx: index("cost_items_tenant_idx").on(t.projectId, t.locationId),
    batchIdx: index("cost_items_batch_idx").on(t.batchId),
    categoryIdx: index("cost_items_category_idx").on(t.categoryKey),
  }),
);

export type CostItem = typeof costItems.$inferSelect;
export type NewCostItem = typeof costItems.$inferInsert;
