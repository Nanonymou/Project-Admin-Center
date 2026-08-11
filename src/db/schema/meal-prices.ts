import { boolean, index, numeric, pgTable, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { auditColumns } from "./columns";

/**
 * Harga Meals — the site-level meal/service default price list backing the
 * `/harga-meals` UI. One row per (project, location, category) with the display
 * label + unit and the effective price. Config-driven and keyed by
 * project_code/location_id (generic, not project-named). Distinct from the
 * generic `master_prices` in that it carries meal-facing metadata (label/unit)
 * and is the write target for the Harga Meals CRUD + change-history features.
 */
export const mealPrices = pgTable(
  "meal_prices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectCode: varchar("project_code", { length: 32 }).notNull(),
    locationId: varchar("location_id", { length: 64 }).notNull(),
    categoryKey: varchar("category_key", { length: 64 }).notNull(),
    label: varchar("label", { length: 128 }).notNull(),
    unit: varchar("unit", { length: 32 }).default("unit").notNull(),
    price: numeric("price", { precision: 18, scale: 2 }).default("0").notNull(),
    /** True when this row is a site-specific custom category (not a config default). */
    custom: boolean("custom").default(false).notNull(),
    active: boolean("active").default(true).notNull(),
    ...auditColumns,
  },
  (t) => ({
    keyIdx: uniqueIndex("meal_prices_key_idx").on(t.projectCode, t.locationId, t.categoryKey),
    locationIdx: index("meal_prices_location_idx").on(t.locationId),
    projectIdx: index("meal_prices_project_idx").on(t.projectCode),
  }),
);

export type MealPrice = typeof mealPrices.$inferSelect;
export type NewMealPrice = typeof mealPrices.$inferInsert;
