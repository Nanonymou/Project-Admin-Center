import { boolean, index, numeric, pgTable, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { auditColumns } from "./columns";

/**
 * Formula Engine parameters (Formula Engine feature) — the tunable inputs that
 * feed invoice/margin calculations (tax rate, penalty, BBM, and custom factors),
 * scoped per project. Rows here are overrides/custom additions layered over the
 * config-derived defaults (tax/penalty/bbm configs); the engine reads the
 * effective parameter as override-if-present-else-default. `value` is numeric
 * (flags stored as 0/1). Backs the `/formula-engine` UI.
 */
export const formulaParameters = pgTable(
  "formula_parameters",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectCode: varchar("project_code", { length: 32 }).notNull(),
    key: varchar("key", { length: 96 }).notNull(),
    label: varchar("label", { length: 160 }).notNull(),
    group: varchar("group", { length: 64 }).notNull().default(""),
    /** percent | days | flag | flat. */
    type: varchar("type", { length: 16 }).notNull(),
    value: numeric("value", { precision: 18, scale: 4 }).default("0").notNull(),
    /** True for built-in (config-derived) parameters overridden here. */
    builtin: boolean("builtin").default(false).notNull(),
    active: boolean("active").default(true).notNull(),
    ...auditColumns,
  },
  (t) => ({
    keyIdx: uniqueIndex("formula_parameters_key_idx").on(t.projectCode, t.key),
    projectIdx: index("formula_parameters_project_idx").on(t.projectCode),
  }),
);

/**
 * Formula Engine parameter change history — non-destructive audit trail of every
 * parameter create/update/activate/deactivate, so calculation inputs can be
 * traced over time (PRD §Master Lock & Version Management). Never updated in place.
 */
export const formulaParameterHistory = pgTable(
  "formula_parameter_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectCode: varchar("project_code", { length: 32 }).notNull(),
    key: varchar("key", { length: 96 }).notNull(),
    label: varchar("label", { length: 160 }).notNull().default(""),
    /** create | update | activate | deactivate. */
    action: varchar("action", { length: 16 }).notNull(),
    beforeValue: varchar("before_value", { length: 64 }),
    afterValue: varchar("after_value", { length: 64 }),
    changedBy: varchar("changed_by", { length: 128 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    projectIdx: index("formula_parameter_history_project_idx").on(t.projectCode),
    keyIdx: index("formula_parameter_history_key_idx").on(t.key),
  }),
);

export type FormulaParameterRow = typeof formulaParameters.$inferSelect;
export type NewFormulaParameterRow = typeof formulaParameters.$inferInsert;
export type FormulaParameterHistoryRow = typeof formulaParameterHistory.$inferSelect;
export type NewFormulaParameterHistoryRow = typeof formulaParameterHistory.$inferInsert;
