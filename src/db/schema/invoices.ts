import { date, index, numeric, pgEnum, pgTable, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { auditColumns, tenancyColumns } from "./columns";

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
 * Monetary values are stored so net = subtotal - deduction + tax.
 */
export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ...tenancyColumns,
    number: varchar("number", { length: 64 }).notNull(),
    subtotal: numeric("subtotal", { precision: 18, scale: 2 }).default("0").notNull(),
    deduction: numeric("deduction", { precision: 18, scale: 2 }).default("0").notNull(),
    tax: numeric("tax", { precision: 18, scale: 2 }).default("0").notNull(),
    amount: numeric("amount", { precision: 18, scale: 2 }).default("0").notNull(),
    status: invoiceStatus("status").default("on_time").notNull(),
    stage: invoiceStage("stage").default("Verifikasi Site").notNull(),
    agingBucket: invoiceAgingBucket("aging_bucket").default("0-30").notNull(),
    issuedDate: date("issued_date"),
    dueDate: date("due_date"),
    pic: varchar("pic", { length: 128 }),
    ...auditColumns,
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
