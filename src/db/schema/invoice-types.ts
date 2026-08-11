import { boolean, index, numeric, pgTable, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { auditColumns } from "./columns";

/**
 * Jenis Invoice — invoice type profiles (PRD §Invoice Type). Each profile shapes
 * how an invoice's financial inputs are derived: the default deduction rate and
 * whether a BBM (fuel) surcharge participates. Generic (not project-named); a
 * null `project_code` marks a shared/global profile, while a set value scopes an
 * override to one project. Backs the `/jenis-invoice` UI's `invoice-type-config`.
 */
export const invoiceTypes = pgTable(
  "invoice_types",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** Null = global profile; otherwise scoped to a project. */
    projectCode: varchar("project_code", { length: 32 }),
    code: varchar("code", { length: 64 }).notNull(),
    label: varchar("label", { length: 128 }).notNull(),
    /** Deduction as a fraction of subtotal (0..1). */
    deductionRate: numeric("deduction_rate", { precision: 6, scale: 4 }).default("0").notNull(),
    hasBbm: boolean("has_bbm").default(false).notNull(),
    /** BBM surcharge as a fraction of subtotal (0..1); used only when has_bbm. */
    bbmRate: numeric("bbm_rate", { precision: 6, scale: 4 }).default("0").notNull(),
    active: boolean("active").default(true).notNull(),
    ...auditColumns,
  },
  (t) => ({
    codeIdx: uniqueIndex("invoice_types_code_idx").on(t.code),
    projectIdx: index("invoice_types_project_idx").on(t.projectCode),
  }),
);

export type InvoiceType = typeof invoiceTypes.$inferSelect;
export type NewInvoiceType = typeof invoiceTypes.$inferInsert;
