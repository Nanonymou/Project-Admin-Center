import { relations } from "drizzle-orm";
import { boolean, index, integer, numeric, pgTable, uuid, varchar } from "drizzle-orm/pg-core";
import { auditColumns, softDeleteColumns, tenancyColumns } from "./columns";
import { invoices } from "./invoices";

/**
 * Invoice line items — the itemized rows that make up an invoice's subtotal
 * (e.g. per priced service category). Tenant-scoped by project_id/location_id and
 * linked to the parent invoice by FK. `category_key` references the config-driven
 * priced category (no project-named columns); `is_deduction` marks a line that
 * reduces the base (e.g. backcharge) rather than adding to it. `amount` is stored
 * as qty × unit_price so the Detail Invoice reproduces the persisted figure
 * without recomputation.
 */
export const invoiceLines = pgTable(
  "invoice_lines",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    ...tenancyColumns,
    categoryKey: varchar("category_key", { length: 64 }),
    label: varchar("label", { length: 256 }).notNull(),
    unit: varchar("unit", { length: 32 }),
    qty: numeric("qty", { precision: 18, scale: 2 }).default("0").notNull(),
    unitPrice: numeric("unit_price", { precision: 18, scale: 2 }).default("0").notNull(),
    amount: numeric("amount", { precision: 18, scale: 2 }).default("0").notNull(),
    isDeduction: boolean("is_deduction").default(false).notNull(),
    lineOrder: integer("line_order").default(0).notNull(),
    ...auditColumns,
    ...softDeleteColumns,
  },
  (t) => ({
    invoiceIdx: index("invoice_lines_invoice_idx").on(t.invoiceId),
    tenantIdx: index("invoice_lines_tenant_idx").on(t.projectId, t.locationId),
    // Serves the Detail Invoice ordered line listing per invoice.
    orderIdx: index("invoice_lines_order_idx").on(t.invoiceId, t.lineOrder),
  }),
);

export const invoiceLinesRelations = relations(invoiceLines, ({ one }) => ({
  invoice: one(invoices, {
    fields: [invoiceLines.invoiceId],
    references: [invoices.id],
  }),
}));

export type InvoiceLine = typeof invoiceLines.$inferSelect;
export type NewInvoiceLine = typeof invoiceLines.$inferInsert;
