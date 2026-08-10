import { boolean, index, numeric, pgTable, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { auditColumns } from "./columns";

/**
 * Master price list per location — one row per (project, location, category).
 * Complements `master_categories` (which holds the base/default price and
 * category metadata) by capturing the location-specific selling price, as the
 * PRD allows pricing to vary by site. Config-driven and keyed by
 * project_code/location_id (not project-named columns); the same generic table
 * serves every project. The pricing engine reads the effective price from here,
 * falling back to the category's default when no per-location row exists.
 */
export const masterPrices = pgTable(
  "master_prices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectCode: varchar("project_code", { length: 32 }).notNull(),
    locationId: varchar("location_id", { length: 64 }).notNull(),
    categoryKey: varchar("category_key", { length: 64 }).notNull(),
    price: numeric("price", { precision: 18, scale: 2 }).default("0").notNull(),
    /** Optional effective-from period (YYYY-MM) for price history/versioning. */
    effectiveFrom: varchar("effective_from", { length: 7 }),
    active: boolean("active").default(true).notNull(),
    ...auditColumns,
  },
  (t) => ({
    keyIdx: uniqueIndex("master_prices_key_idx").on(t.projectCode, t.locationId, t.categoryKey),
    projectIdx: index("master_prices_project_idx").on(t.projectCode),
    locationIdx: index("master_prices_location_idx").on(t.locationId),
  }),
);

export type MasterPrice = typeof masterPrices.$inferSelect;
export type NewMasterPrice = typeof masterPrices.$inferInsert;
