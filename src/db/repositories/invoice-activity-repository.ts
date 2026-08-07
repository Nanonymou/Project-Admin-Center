import { and, desc, eq, gte, lte, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { invoiceActivities, type InvoiceActivity } from "@/db/schema";

export type ActivityFilter = {
  /** Required for tenant scope; omit only for cross-site (executive) views. */
  projectId?: string;
  locationId?: string;
  action?: string;
  invoiceId?: string;
  from?: string; // created_at lower bound (YYYY-MM-DD)
  to?: string; // created_at upper bound (YYYY-MM-DD)
  limit?: number;
  /** "tenant" enforces a project filter; "executive" allows cross-project. */
  scope?: "tenant" | "executive";
};

function buildWhere(filter: ActivityFilter): SQL | undefined {
  const conds: SQL[] = [];
  // Multi-tenancy: never query without a project filter unless Executive scope.
  if (filter.scope !== "executive") {
    if (!filter.projectId) {
      throw new Error("projectId is required for tenant-scoped activity queries");
    }
    conds.push(eq(invoiceActivities.projectId, filter.projectId));
  } else if (filter.projectId) {
    conds.push(eq(invoiceActivities.projectId, filter.projectId));
  }
  if (filter.locationId) conds.push(eq(invoiceActivities.locationId, filter.locationId));
  if (filter.action) conds.push(eq(invoiceActivities.action, filter.action as InvoiceActivity["action"]));
  if (filter.invoiceId) conds.push(eq(invoiceActivities.invoiceId, filter.invoiceId));
  if (filter.from) conds.push(gte(invoiceActivities.createdAt, new Date(`${filter.from}T00:00:00Z`)));
  if (filter.to) conds.push(lte(invoiceActivities.createdAt, new Date(`${filter.to}T23:59:59Z`)));
  return conds.length ? and(...conds) : undefined;
}

/**
 * Aggregate invoice-activity feed across the filtered scope, newest first.
 * Repository Pattern: all DB access to the invoice_activities table flows
 * through this module; multi-tenancy is enforced in `buildWhere`.
 */
export async function listAggregateActivities(filter: ActivityFilter): Promise<InvoiceActivity[]> {
  const where = buildWhere(filter);
  const limit = Math.min(Math.max(filter.limit ?? 200, 1), 1000);
  return db
    .select()
    .from(invoiceActivities)
    .where(where)
    .orderBy(desc(invoiceActivities.createdAt))
    .limit(limit);
}
