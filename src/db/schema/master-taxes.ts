import { boolean, index, numeric, pgTable, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { auditColumns } from "./columns";

/**
 * Master Tax Engine — per-project tax profiles (PRD Appendix §16.D Formula
 * Matrix). Each row defines the tax applied to a project's invoices: its code
 * (PPN / PB1 / …), label, and fractional rate. Config-driven and keyed by
 * project_code (not project-named columns); a null project_code marks a shared
 * default profile. The tax engine reads the effective rate from here, falling
 * back to the config matrix when no row exists. Backs the `/master-tax` UI.
 */
export const masterTaxes = pgTable(
  "master_taxes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** Null = global default profile; otherwise scoped to a project. */
    projectCode: varchar("project_code", { length: 32 }),
    code: varchar("code", { length: 32 }).notNull(),
    label: varchar("label", { length: 128 }).notNull(),
    /** Tax rate as a fraction of the taxable base (0..1). */
    rate: numeric("rate", { precision: 6, scale: 4 }).default("0").notNull(),
    active: boolean("active").default(true).notNull(),
    ...auditColumns,
  },
  (t) => ({
    projectIdx: uniqueIndex("master_taxes_project_idx").on(t.projectCode),
    codeIdx: index("master_taxes_code_idx").on(t.code),
  }),
);

export type MasterTaxRow = typeof masterTaxes.$inferSelect;
export type NewMasterTaxRow = typeof masterTaxes.$inferInsert;
