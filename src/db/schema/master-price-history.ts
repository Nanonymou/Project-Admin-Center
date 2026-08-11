import { index, numeric, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

/**
 * Master Pricing Engine change history — a non-destructive trail of every change
 * to the per-location price list (`master_prices`), per PRD §Master Lock &
 * Version Management. One row per action (create/update/activate/deactivate) with
 * the before/after price, keyed generically by project_code/location_id/
 * category_key. Backs the pricing engine's "Riwayat Perubahan Harga" view; never
 * updated in place.
 */
export const masterPriceHistory = pgTable(
  "master_price_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectCode: varchar("project_code", { length: 32 }).notNull(),
    locationId: varchar("location_id", { length: 64 }).notNull(),
    categoryKey: varchar("category_key", { length: 64 }).notNull(),
    categoryLabel: varchar("category_label", { length: 128 }).notNull().default(""),
    /** create | update | activate | deactivate. */
    action: varchar("action", { length: 16 }).notNull(),
    /** Previous price (null for create/activate/deactivate). */
    beforePrice: numeric("before_price", { precision: 18, scale: 2 }),
    /** New price (null for activate/deactivate). */
    afterPrice: numeric("after_price", { precision: 18, scale: 2 }),
    changedBy: varchar("changed_by", { length: 128 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    siteIdx: index("master_price_history_site_idx").on(t.projectCode, t.locationId),
    categoryIdx: index("master_price_history_category_idx").on(t.categoryKey),
  }),
);

export type MasterPriceHistoryRow = typeof masterPriceHistory.$inferSelect;
export type NewMasterPriceHistoryRow = typeof masterPriceHistory.$inferInsert;
