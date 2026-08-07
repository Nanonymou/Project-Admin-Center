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

export type SiteKpiAggregate = {
  projectId: string;
  locationId: string;
  sales: number;
  cost: number;
  profit: number;
  transactions: number;
};

/**
 * Aggregate KPIs grouped per site (project + location). Used by the
 * "KPI Seluruh Site" endpoint for Leader/Super Admin cross-site views.
 */
export async function aggregateKpisBySite(filter: DashboardFilter): Promise<SiteKpiAggregate[]> {
  const where = buildWhere(filter);

  const rows = await db
    .select({
      projectId: dailyTransactions.projectId,
      locationId: dailyTransactions.locationId,
      kind: dailyTransactions.kind,
      total: sql<string>`coalesce(sum(${dailyTransactions.total}), 0)`,
      count: count(),
    })
    .from(dailyTransactions)
    .where(where)
    .groupBy(dailyTransactions.projectId, dailyTransactions.locationId, dailyTransactions.kind);

  const map = new Map<string, SiteKpiAggregate>();
  for (const r of rows) {
    const key = `${r.projectId}::${r.locationId}`;
    const entry =
      map.get(key) ??
      { projectId: r.projectId, locationId: r.locationId, sales: 0, cost: 0, profit: 0, transactions: 0 };
    const value = Number(r.total);
    if (r.kind === "sales") entry.sales += value;
    else entry.cost += value;
    entry.transactions += Number(r.count);
    map.set(key, entry);
  }

  return Array.from(map.values())
    .map((e) => ({ ...e, profit: e.sales - e.cost }))
    .sort((a, b) => b.profit - a.profit);
}

export type PeriodPoint = { period: string; sales: number; cost: number; profit: number };
export type PeriodGranularity = "day" | "month";

/**
 * Time-series aggregation for interactive charts — sales/cost/profit bucketed
 * by day or month across the filtered range.
 */
export async function aggregateByPeriod(
  filter: DashboardFilter,
  granularity: PeriodGranularity = "day",
): Promise<PeriodPoint[]> {
  const where = buildWhere(filter);
  const fmt = granularity === "month" ? "YYYY-MM" : "YYYY-MM-DD";
  const bucket = sql<string>`to_char(${dailyTransactions.trxDate}, ${fmt})`;

  const rows = await db
    .select({
      period: bucket,
      kind: dailyTransactions.kind,
      total: sql<string>`coalesce(sum(${dailyTransactions.total}), 0)`,
    })
    .from(dailyTransactions)
    .where(where)
    .groupBy(bucket, dailyTransactions.kind)
    .orderBy(bucket);

  const map = new Map<string, PeriodPoint>();
  for (const r of rows) {
    const entry = map.get(r.period) ?? { period: r.period, sales: 0, cost: 0, profit: 0 };
    const value = Number(r.total);
    if (r.kind === "sales") entry.sales += value;
    else entry.cost += value;
    map.set(r.period, entry);
  }

  return Array.from(map.values())
    .map((e) => ({ ...e, profit: e.sales - e.cost }))
    .sort((a, b) => (a.period < b.period ? -1 : 1));
}
