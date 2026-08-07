import { boolean, index, numeric, pgEnum, pgTable, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { auditColumns } from "./columns";

/** Which side of the ledger a master category belongs to. */
export const masterCategoryKind = pgEnum("master_category_kind", ["sales", "cost"]);

/**
 * Master price list — one row per (project, kind, category). Holds the
 * config-driven default price, unit, sub-category grouping, and deduction flag
 * for each service/cost category so the daily-entry forms and pricing engine can
 * read prices from the database instead of only from in-memory config. Keyed by
 * project_code (not project-named columns); the same generic table serves every
 * project.
 */
export const masterCategories = pgTable(
  "master_categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectCode: varchar("project_code", { length: 32 }).notNull(),
    kind: masterCategoryKind("kind").notNull(),
    categoryKey: varchar("category_key", { length: 64 }).notNull(),
    label: varchar("label", { length: 128 }).notNull(),
    subCategory: varchar("sub_category", { length: 64 }),
    unit: varchar("unit", { length: 32 }),
    defaultPrice: numeric("default_price", { precision: 18, scale: 2 }).default("0").notNull(),
    isDeduction: boolean("is_deduction").default(false).notNull(),
    active: boolean("active").default(true).notNull(),
    ...auditColumns,
  },
  (t) => ({
    keyIdx: uniqueIndex("master_categories_key_idx").on(t.projectCode, t.kind, t.categoryKey),
    projectIdx: index("master_categories_project_idx").on(t.projectCode),
  }),
);

export type MasterCategory = typeof masterCategories.$inferSelect;
export type NewMasterCategory = typeof masterCategories.$inferInsert;
