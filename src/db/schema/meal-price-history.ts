import { index, numeric, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

/**
 * Harga Meals change history — a non-destructive audit of every meal-price
 * change (create / update / activate / deactivate), per PRD §Version Management.
 * Rows are append-only; the current price lives in `meal_prices` while this table
 * preserves the full trail for the "Riwayat Perubahan Harga" view.
 */
export const mealPriceHistory = pgTable(
  "meal_price_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectCode: varchar("project_code", { length: 32 }).notNull(),
    locationId: varchar("location_id", { length: 64 }).notNull(),
    categoryKey: varchar("category_key", { length: 64 }).notNull(),
    categoryLabel: varchar("category_label", { length: 128 }).notNull(),
    /** create | update | activate | deactivate */
    action: varchar("action", { length: 16 }).notNull(),
    beforePrice: numeric("before_price", { precision: 18, scale: 2 }),
    afterPrice: numeric("after_price", { precision: 18, scale: 2 }),
    changedBy: varchar("changed_by", { length: 128 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    siteIdx: index("meal_price_history_site_idx").on(t.projectCode, t.locationId),
    categoryIdx: index("meal_price_history_category_idx").on(t.locationId, t.categoryKey),
  }),
);

export type MealPriceHistory = typeof mealPriceHistory.$inferSelect;
export type NewMealPriceHistory = typeof mealPriceHistory.$inferInsert;
