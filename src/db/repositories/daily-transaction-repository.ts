import { and, count, eq, gte, lte, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { dailyTransactions } from "@/db/schema";

export type DashboardFilter = {
  /** Required for tenant scope; omit only for the Executive Dashboard. */
  projectId?: string;
  locationId?: string;
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD
  /** "tenant" enforces a project filter; "executive" allows cross-project. */
  scope?: "tenant" | "executive";
};

export type DashboardAggregate = {
  totals: { sales: number; cost: number; profit: number; transactions: number };
  byStatus: Record<string, number>;
};

function buildWhere(filter: DashboardFilter): SQL | undefined {
  const conds: SQL[] = [];
  // Multi-tenancy: never query without a project filter unless Executive scope.
  if (filter.scope !== "executive") {
    if (!filter.projectId) {
      throw new Error("projectId is required for tenant-scoped dashboard queries");
    }
    conds.push(eq(dailyTransactions.projectId, filter.projectId));
  } else if (filter.projectId) {
    conds.push(eq(dailyTransactions.projectId, filter.projectId));
  }
  if (filter.locationId) conds.push(eq(dailyTransactions.locationId, filter.locationId));
  if (filter.from) conds.push(gte(dailyTransactions.trxDate, filter.from));
  if (filter.to) conds.push(lte(dailyTransactions.trxDate, filter.to));
  return conds.length ? and(...conds) : undefined;
}

/**
 * Aggregate daily transactions for the dashboard — totals split by kind
 * (sales/cost) and counts per closing status. Repository Pattern: all DB
 * access to daily transactions goes through this module.
 */
export async function aggregateDashboard(filter: DashboardFilter): Promise<DashboardAggregate> {
  const where = buildWhere(filter);

  const byKind = await db
    .select({
      kind: dailyTransactions.kind,
      total: sql<string>`coalesce(sum(${dailyTransactions.total}), 0)`,
      count: count(),
    })
    .from(dailyTransactions)
    .where(where)
    .groupBy(dailyTransactions.kind);

  const byStatusRows = await db
    .select({ status: dailyTransactions.status, count: count() })
    .from(dailyTransactions)
    .where(where)
    .groupBy(dailyTransactions.status);

  let sales = 0;
  let cost = 0;
  let transactions = 0;
  for (const r of byKind) {
    const value = Number(r.total);
    if (r.kind === "sales") sales += value;
    else cost += value;
    transactions += Number(r.count);
  }

  const byStatus: Record<string, number> = {};
  for (const r of byStatusRows) byStatus[r.status] = Number(r.count);

  return {
    totals: { sales, cost, profit: sales - cost, transactions },
    byStatus,
  };
}
