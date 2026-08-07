import { sql } from "drizzle-orm";
import { pgView } from "drizzle-orm/pg-core";
import { invoices } from "./invoices";

/**
 * Per-site invoice rollup — one row per (project, location, status, aging bucket)
 * with the invoice count and total amount. Derived from the generic invoices
 * table (no project-named invoice table; the same model serves every project,
 * PHKT included). Backs the invoice-monitoring dashboards.
 */
export const invoiceBySite = pgView("invoice_by_site").as((qb) =>
  qb
    .select({
      projectId: invoices.projectId,
      locationId: invoices.locationId,
      status: invoices.status,
      agingBucket: invoices.agingBucket,
      count: sql<number>`count(*)`.as("count"),
      amount: sql<string>`coalesce(sum(${invoices.amount}), 0)`.as("amount"),
    })
    .from(invoices)
    .groupBy(invoices.projectId, invoices.locationId, invoices.status, invoices.agingBucket),
);

export type InvoiceBySiteRow = typeof invoiceBySite.$inferSelect;
