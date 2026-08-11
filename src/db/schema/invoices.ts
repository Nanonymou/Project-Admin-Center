import { date, index, integer, numeric, pgEnum, pgTable, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { auditColumns, softDeleteColumns, tenancyColumns } from "./columns";

export const invoiceStatus = pgEnum("invoice_status", ["on_time", "at_risk", "overdue", "settled"]);

export const invoiceStage = pgEnum("invoice_stage", [
  "Verifikasi Site",
  "Approval Leader",
  "Verifikasi Finance",
  "Kirim Client",
  "Payment",
]);

export const invoiceAgingBucket = pgEnum("invoice_aging_bucket", ["0-30", "31-60", "61-90", ">90"]);

/**
 * Invoices — one row per invoice, tenant-scoped by project_id/location_id.
 * Monetary values persist the full config-driven Formula Engine breakdown so a
 * saved invoice reproduces exactly what `computeInvoice` derived at issue time:
 *   base = subtotal - deduction
 *   taxable_base = base (+ bbm_amount when the project's BBM config is taxable)
 *   amount (total) = base + bbm_amount + tax + penalty_amount
 * Rate/label columns (tax_code, tax_rate, penalty_rate) snapshot the per-project
 * config that was in effect, so the number never drifts if config changes later.
 */
export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ...tenancyColumns,
    number: varchar("number", { length: 64 }).notNull(),
    subtotal: numeric("subtotal", { precision: 18, scale: 2 }).default("0").notNull(),
    deduction: numeric("deduction", { precision: 18, scale: 2 }).default("0").notNull(),
    // Service base = subtotal - deduction.
    base: numeric("base", { precision: 18, scale: 2 }).default("0").notNull(),
    // BBM (fuel) surcharge applied when the project's BBM config enables it.
    bbmAmount: numeric("bbm_amount", { precision: 18, scale: 2 }).default("0").notNull(),
    // Amount the tax rate was applied to (base, plus taxable BBM per config).
    taxableBase: numeric("taxable_base", { precision: 18, scale: 2 }).default("0").notNull(),
    taxCode: varchar("tax_code", { length: 16 }),
    taxRate: numeric("tax_rate", { precision: 6, scale: 4 }).default("0").notNull(),
    tax: numeric("tax", { precision: 18, scale: 2 }).default("0").notNull(),
    // Late-payment penalty snapshot.
    overdueDays: integer("overdue_days").default(0).notNull(),
    penaltyRate: numeric("penalty_rate", { precision: 6, scale: 4 }).default("0").notNull(),
    penaltyMonths: integer("penalty_months").default(0).notNull(),
    penaltyAmount: numeric("penalty_amount", { precision: 18, scale: 2 }).default("0").notNull(),
    // Grand total = base + bbm_amount + tax + penalty_amount.
    amount: numeric("amount", { precision: 18, scale: 2 }).default("0").notNull(),
    status: invoiceStatus("status").default("on_time").notNull(),
    stage: invoiceStage("stage").default("Verifikasi Site").notNull(),
    agingBucket: invoiceAgingBucket("aging_bucket").default("0-30").notNull(),
    issuedDate: date("issued_date"),
    dueDate: date("due_date"),
    pic: varchar("pic", { length: 128 }),
    ...auditColumns,
    ...softDeleteColumns,
  },
  (t) => ({
    numberIdx: uniqueIndex("invoices_number_idx").on(t.number),
    tenantIdx: index("invoices_tenant_idx").on(t.projectId, t.locationId),
    statusIdx: index("invoices_status_idx").on(t.status),
    stageIdx: index("invoices_stage_idx").on(t.stage),
    dueIdx: index("invoices_due_idx").on(t.dueDate),
    // Serves the KPI Utama Site aggregation: outstanding/collection per site.
    kpiIdx: index("invoices_kpi_idx").on(t.projectId, t.locationId, t.status),
    // Serves the Invoice Aging Dashboard: aging buckets per site ordered by due date.
    agingIdx: index("invoices_aging_idx").on(t.projectId, t.locationId, t.agingBucket, t.dueDate),
  }),
);

export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;
