import { and, count, desc, eq, gte, isNull, lte, ne, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { invoices, type Invoice, type NewInvoice } from "@/db/schema";

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
  // Soft delete: recycled invoices are excluded from every read.
  conds.push(isNull(invoices.deletedAt));
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

/** List invoices for the filtered scope (all statuses), newest due date first. */
export async function listInvoices(filter: InvoiceFilter): Promise<Invoice[]> {
  const where = buildWhere(filter);
  return db.select().from(invoices).where(where).orderBy(desc(invoices.dueDate));
}

export type InvoiceRollupRow = {
  projectId: string;
  locationId: string;
  status: string;
  agingBucket: string;
  count: number;
  amount: number;
};

/**
 * Per-site invoice rollup (count + amount by status and aging bucket). Aggregated
 * directly from the invoices table through `buildWhere` so soft-deleted rows are
 * excluded (the invoice_by_site view cannot expose deleted_at for filtering).
 * Tenant-scoped: a tenant query requires a projectId.
 */
export async function listInvoiceRollup(filter: InvoiceFilter): Promise<InvoiceRollupRow[]> {
  const where = buildWhere(filter);
  const rows = await db
    .select({
      projectId: invoices.projectId,
      locationId: invoices.locationId,
      status: invoices.status,
      agingBucket: invoices.agingBucket,
      count: count(),
      amount: sql<string>`coalesce(sum(${invoices.amount}), 0)`,
    })
    .from(invoices)
    .where(where)
    .groupBy(invoices.projectId, invoices.locationId, invoices.status, invoices.agingBucket);
  return rows.map((r) => ({
    projectId: r.projectId,
    locationId: r.locationId,
    status: r.status,
    agingBucket: r.agingBucket,
    count: Number(r.count),
    amount: Number(r.amount),
  }));
}

/** Fetch a single invoice by id, or null. */
export async function getInvoiceById(id: string): Promise<Invoice | null> {
  const [row] = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, id), isNull(invoices.deletedAt)))
    .limit(1);
  return row ?? null;
}

/** Create an invoice. */
export async function createInvoice(values: NewInvoice): Promise<Invoice> {
  const [row] = await db.insert(invoices).values(values).returning();
  return row;
}

/** Patch an invoice by id. Returns the updated row, or null when not found. */
export async function updateInvoice(
  id: string,
  patch: Partial<NewInvoice>,
): Promise<Invoice | null> {
  const [row] = await db
    .update(invoices)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(invoices.id, id))
    .returning();
  return row ?? null;
}

/**
 * Soft-delete an invoice — marks it recycled (deleted_at) instead of removing
 * it, so it can be restored from the Recycle Bin. Returns true when a live row
 * was recycled.
 */
export async function deleteInvoice(id: string, actor?: string): Promise<boolean> {
  const rows = await db
    .update(invoices)
    .set({ deletedAt: new Date(), deletedBy: actor, updatedAt: new Date() })
    .where(and(eq(invoices.id, id), isNull(invoices.deletedAt)))
    .returning({ id: invoices.id });
  return rows.length > 0;
}

export type OutstandingAggregate = {
  outstandingCount: number;
  outstandingAmount: number;
  overdueCount: number;
  overdueAmount: number;
};

/**
 * Aggregate outstanding-invoice KPIs for the KPI summary — total count/amount of
 * invoices not yet settled, and the overdue subset. Multi-tenancy is enforced by
 * `buildWhere`.
 */
export async function aggregateOutstanding(filter: InvoiceFilter): Promise<OutstandingAggregate> {
  const outstanding = or(ne(invoices.status, "settled"), eq(invoices.status, "overdue"));
  const where = buildWhere(filter, outstanding);

  const overdueAmt = sql<string>`coalesce(sum(case when ${invoices.status} = 'overdue' then ${invoices.amount} else 0 end), 0)`;
  const overdueCnt = sql<number>`count(*) filter (where ${invoices.status} = 'overdue')`;

  const [row] = await db
    .select({
      outstandingCount: count(),
      outstandingAmount: sql<string>`coalesce(sum(${invoices.amount}), 0)`,
      overdueCount: overdueCnt,
      overdueAmount: overdueAmt,
    })
    .from(invoices)
    .where(where);

  return {
    outstandingCount: Number(row?.outstandingCount ?? 0),
    outstandingAmount: Number(row?.outstandingAmount ?? 0),
    overdueCount: Number(row?.overdueCount ?? 0),
    overdueAmount: Number(row?.overdueAmount ?? 0),
  };
}
