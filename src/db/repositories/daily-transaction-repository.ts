import { and, count, eq, gte, lte, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  dailyTransactionLines,
  dailyTransactions,
  type DailyTransaction,
  type NewDailyTransactionLine,
} from "@/db/schema";

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
 * Sales & cost aggregated per site in a single pass using conditional
 * aggregation (SUM CASE WHEN kind…), so each site yields one row with both
 * totals — no client-side folding needed.
 */
export async function aggregateSalesCostBySite(filter: DashboardFilter): Promise<SiteKpiAggregate[]> {
  const where = buildWhere(filter);

  const rows = await db
    .select({
      projectId: dailyTransactions.projectId,
      locationId: dailyTransactions.locationId,
      sales: sql<string>`coalesce(sum(case when ${dailyTransactions.kind} = 'sales' then ${dailyTransactions.total} else 0 end), 0)`,
      cost: sql<string>`coalesce(sum(case when ${dailyTransactions.kind} = 'cost' then ${dailyTransactions.total} else 0 end), 0)`,
      transactions: count(),
    })
    .from(dailyTransactions)
    .where(where)
    .groupBy(dailyTransactions.projectId, dailyTransactions.locationId);

  return rows.map((r) => {
    const sales = Number(r.sales);
    const cost = Number(r.cost);
    return {
      projectId: r.projectId,
      locationId: r.locationId,
      sales,
      cost,
      profit: sales - cost,
      transactions: Number(r.transactions),
    };
  });
}

/**
 * Aggregate KPIs grouped per site (project + location). Used by the
 * "KPI Seluruh Site" endpoint for Leader/Super Admin cross-site views.
 */
export async function aggregateKpisBySite(filter: DashboardFilter): Promise<SiteKpiAggregate[]> {
  const sites = await aggregateSalesCostBySite(filter);
  return sites.sort((a, b) => b.profit - a.profit);
}

export type DailySubmissionLine = {
  categoryKey: string;
  label: string;
  qty?: string;
  unitPrice?: string;
  amount: string;
  isDeduction?: boolean;
};

export type DailySubmissionInput = {
  projectId: string;
  locationId: string;
  kind: "sales" | "cost";
  trxDate: string; // YYYY-MM-DD
  area?: string;
  subtotal: string;
  tax: string;
  total: string;
  isLate: boolean;
  submittedBy: string;
  lines: DailySubmissionLine[];
};

/**
 * Persist a daily submission (sales or cost) header plus its line items in one
 * transaction, marked as submitted. Returns the created header. The caller is
 * responsible for authorization and for computing totals / the late flag.
 */
export async function createDailySubmission(input: DailySubmissionInput): Promise<DailyTransaction> {
  return db.transaction(async (tx) => {
    const [header] = await tx
      .insert(dailyTransactions)
      .values({
        projectId: input.projectId,
        locationId: input.locationId,
        kind: input.kind,
        trxDate: input.trxDate,
        area: input.area,
        status: "submitted",
        subtotal: input.subtotal,
        tax: input.tax,
        total: input.total,
        submittedAt: new Date(),
        submittedBy: input.submittedBy,
        isLate: input.isLate,
        createdBy: input.submittedBy,
      })
      .returning();

    if (input.lines.length) {
      const rows: NewDailyTransactionLine[] = input.lines.map((l) => ({
        transactionId: header.id,
        projectId: input.projectId,
        locationId: input.locationId,
        categoryKey: l.categoryKey,
        label: l.label,
        qty: l.qty ?? "1",
        unitPrice: l.unitPrice ?? l.amount,
        amount: l.amount,
        isDeduction: l.isDeduction ?? false,
      }));
      await tx.insert(dailyTransactionLines).values(rows);
    }

    return header;
  });
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
