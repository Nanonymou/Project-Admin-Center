import { and, desc, eq, gte, lte, ne, or, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { invoices, type Invoice } from "@/db/schema";

export type InvoiceFilter = {
  /** Required for tenant scope; omit only for cross-site (executive) views. */
  projectId?: string;
  locationId?: string;
  status?: string;
  stage?: string;
  agingBucket?: string;
  from?: string; // due date lower bound, YYYY-MM-DD
  to?: string; // due date upper bound, YYYY-MM-DD
  /** "tenant" enforces a project filter; "executive" allows cross-project. */
  scope?: "tenant" | "executive";
};

function buildWhere(filter: InvoiceFilter, base?: SQL): SQL | undefined {
  const conds: SQL[] = [];
  if (base) conds.push(base);
  // Multi-tenancy: never query without a project filter unless Executive scope.
  if (filter.scope !== "executive") {
    if (!filter.projectId) {
      throw new Error("projectId is required for tenant-scoped invoice queries");
    }
    conds.push(eq(invoices.projectId, filter.projectId));
  } else if (filter.projectId) {
    conds.push(eq(invoices.projectId, filter.projectId));
  }
  if (filter.locationId) conds.push(eq(invoices.locationId, filter.locationId));
  if (filter.status) conds.push(eq(invoices.status, filter.status as Invoice["status"]));
  if (filter.stage) conds.push(eq(invoices.stage, filter.stage as Invoice["stage"]));
  if (filter.agingBucket) {
    conds.push(eq(invoices.agingBucket, filter.agingBucket as Invoice["agingBucket"]));
  }
  if (filter.from) conds.push(gte(invoices.dueDate, filter.from));
  if (filter.to) conds.push(lte(invoices.dueDate, filter.to));
  return conds.length ? and(...conds) : undefined;
}

/**
 * List outstanding invoices — anything not yet settled, plus anything overdue —
 * across the sites the filter permits. Repository Pattern: all DB access to the
 * invoices table flows through this module. Multi-tenancy is enforced in
 * `buildWhere` (a tenant-scoped query without a projectId throws).
 */
export async function listOutstandingInvoices(filter: InvoiceFilter): Promise<Invoice[]> {
  // Outstanding = not settled OR overdue (an overdue invoice stays outstanding
  // even if a later status somehow reads settled).
  const outstanding = or(ne(invoices.status, "settled"), eq(invoices.status, "overdue"));
  const where = buildWhere(filter, outstanding);

  return db.select().from(invoices).where(where).orderBy(desc(invoices.dueDate));
}
