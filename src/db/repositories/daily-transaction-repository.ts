import { and, count, desc, eq, gte, lte, ne, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  dailyTransactionLines,
  dailyTransactionLogs,
  dailyTransactions,
  type DailyTransaction,
  type DailyTransactionLine,
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
  areaId?: string;
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
        areaId: input.areaId,
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

    // Change-log: record the submission so the entry's history is auditable.
    await tx.insert(dailyTransactionLogs).values({
      transactionId: header.id,
      projectId: input.projectId,
      locationId: input.locationId,
      action: "submit",
      actor: input.submittedBy,
      toStatus: "submitted",
      detail: `Entri ${input.kind} ${input.trxDate} disubmit.`,
    });

    return header;
  });
}

export type SiteSubmissionStatus = {
  projectId: string;
  locationId: string;
  total: number;
  draft: number;
  submitted: number;
  approved: number;
  locked: number;
  late: number;
};

/**
 * Per-site submission status counts for daily transactions of a given kind
 * (defaults to cost). Groups by site and folds the status enum plus the late
 * flag into one row per site. Multi-tenancy enforced by `buildWhere`.
 */
export async function aggregateSubmissionStatusBySite(
  filter: DashboardFilter,
  kind: "sales" | "cost" = "cost",
): Promise<SiteSubmissionStatus[]> {
  const where = buildWhere(filter);
  const kindCond = eq(dailyTransactions.kind, kind);
  const combined = where ? and(where, kindCond) : kindCond;

  const rows = await db
    .select({
      projectId: dailyTransactions.projectId,
      locationId: dailyTransactions.locationId,
      total: count(),
      draft: sql<number>`count(*) filter (where ${dailyTransactions.status} = 'draft')`,
      submitted: sql<number>`count(*) filter (where ${dailyTransactions.status} = 'submitted')`,
      approved: sql<number>`count(*) filter (where ${dailyTransactions.status} = 'approved')`,
      locked: sql<number>`count(*) filter (where ${dailyTransactions.status} = 'locked')`,
      late: sql<number>`count(*) filter (where ${dailyTransactions.isLate} = true)`,
    })
    .from(dailyTransactions)
    .where(combined)
    .groupBy(dailyTransactions.projectId, dailyTransactions.locationId);

  return rows.map((r) => ({
    projectId: r.projectId,
    locationId: r.locationId,
    total: Number(r.total),
    draft: Number(r.draft),
    submitted: Number(r.submitted),
    approved: Number(r.approved),
    locked: Number(r.locked),
    late: Number(r.late),
  }));
}

export type DailyTransactionStatusValue = DailyTransaction["status"];

/**
 * List daily-transaction submission history for a given kind (defaults to cost),
 * newest transaction date first. Used by the "Riwayat Submit" view. Multi-tenancy
 * enforced by `buildWhere`; `limit` is clamped.
 */
export async function listDailySubmissions(
  filter: DashboardFilter,
  kind: "sales" | "cost" = "cost",
  limit = 200,
  status?: DailyTransactionStatusValue,
): Promise<DailyTransaction[]> {
  const where = buildWhere(filter);
  const conds: SQL[] = [eq(dailyTransactions.kind, kind)];
  if (where) conds.push(where);
  if (status) conds.push(eq(dailyTransactions.status, status));
  const combined = and(...conds);
  const capped = Math.min(Math.max(limit, 1), 1000);
  return db
    .select()
    .from(dailyTransactions)
    .where(combined)
    .orderBy(desc(dailyTransactions.trxDate), desc(dailyTransactions.submittedAt))
    .limit(capped);
}

/**
 * Fetch a single daily transaction by id (or null). The row carries
 * project_id/location_id so the caller can enforce scope before mutating.
 */
export async function getDailyTransactionById(id: string): Promise<DailyTransaction | null> {
  const [row] = await db.select().from(dailyTransactions).where(eq(dailyTransactions.id, id)).limit(1);
  return row ?? null;
}

/**
 * Unlock a locked daily transaction — reopen it to `submitted` and clear the
 * lock timestamp so a site can correct it. Returns the updated row, or null when
 * the id does not exist. Only transactions currently `locked` are changed.
 */
export async function unlockDailyTransaction(
  id: string,
  reopenTo: DailyTransactionStatusValue = "submitted",
): Promise<DailyTransaction | null> {
  const [row] = await db
    .update(dailyTransactions)
    .set({ status: reopenTo, lockedAt: null, updatedAt: new Date() })
    .where(and(eq(dailyTransactions.id, id), eq(dailyTransactions.status, "locked")))
    .returning();
  return row ?? null;
}

/** Fetch a daily transaction header together with its line items, or null. */
export async function getDailyTransactionWithLines(
  id: string,
): Promise<{ header: DailyTransaction; lines: DailyTransactionLine[] } | null> {
  const header = await getDailyTransactionById(id);
  if (!header) return null;
  const lines = await db
    .select()
    .from(dailyTransactionLines)
    .where(eq(dailyTransactionLines.transactionId, id));
  return { header, lines };
}

/**
 * Update a daily submission header and replace its line items atomically. Only a
 * transaction that is not yet locked may be edited; returns the updated header,
 * or null when the id does not exist or is locked.
 */
export async function updateDailySubmission(
  id: string,
  input: DailySubmissionInput,
): Promise<DailyTransaction | null> {
  return db.transaction(async (tx) => {
    const [header] = await tx
      .update(dailyTransactions)
      .set({
        trxDate: input.trxDate,
        area: input.area,
        areaId: input.areaId,
        subtotal: input.subtotal,
        tax: input.tax,
        total: input.total,
        isLate: input.isLate,
        updatedAt: new Date(),
      })
      .where(and(eq(dailyTransactions.id, id), ne(dailyTransactions.status, "locked")))
      .returning();
    if (!header) return null;

    await tx.delete(dailyTransactionLines).where(eq(dailyTransactionLines.transactionId, id));
    if (input.lines.length) {
      const rows: NewDailyTransactionLine[] = input.lines.map((l) => ({
        transactionId: id,
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

    // Change-log: record the edit for the entry's history.
    await tx.insert(dailyTransactionLogs).values({
      transactionId: id,
      projectId: input.projectId,
      locationId: input.locationId,
      action: "edit",
      actor: input.submittedBy,
      toStatus: header.status,
      detail: `Entri ${input.kind} ${input.trxDate} diubah.`,
    });

    return header;
  });
}

/** Delete a daily transaction (lines cascade). Returns true when a row was removed. */
export async function deleteDailyTransaction(id: string): Promise<boolean> {
  const rows = await db
    .delete(dailyTransactions)
    .where(eq(dailyTransactions.id, id))
    .returning({ id: dailyTransactions.id });
  return rows.length > 0;
}

export type CategoryTotal = { categoryKey: string; label: string; amount: number };

/**
 * Sales (or cost) totals grouped by category, summed from the line items joined
 * to headers of the given kind. Used by the dashboard's category breakdown.
 * Multi-tenancy is enforced through the header filter in `buildWhere`.
 */
export async function aggregateByCategory(
  filter: DashboardFilter,
  kind: "sales" | "cost" = "sales",
): Promise<CategoryTotal[]> {
  const where = buildWhere(filter);
  const kindCond = eq(dailyTransactions.kind, kind);
  const combined = where ? and(where, kindCond) : kindCond;

  const rows = await db
    .select({
      categoryKey: dailyTransactionLines.categoryKey,
      label: sql<string>`max(${dailyTransactionLines.label})`,
      amount: sql<string>`coalesce(sum(${dailyTransactionLines.amount}), 0)`,
    })
    .from(dailyTransactionLines)
    .innerJoin(dailyTransactions, eq(dailyTransactionLines.transactionId, dailyTransactions.id))
    .where(combined)
    .groupBy(dailyTransactionLines.categoryKey);

  return rows
    .map((r) => ({ categoryKey: r.categoryKey, label: r.label, amount: Number(r.amount) }))
    .sort((a, b) => b.amount - a.amount);
}

export type AreaTotal = { area: string; sales: number; transactions: number };

/**
 * Sales totals grouped by sales area, for the given kind (defaults to sales).
 * Rows with no area are bucketed under "(Tanpa Area)". Multi-tenancy enforced by
 * the header filter in `buildWhere`.
 */
export async function aggregateSalesByArea(
  filter: DashboardFilter,
  kind: "sales" | "cost" = "sales",
): Promise<AreaTotal[]> {
  const where = buildWhere(filter);
  const kindCond = eq(dailyTransactions.kind, kind);
  const combined = where ? and(where, kindCond) : kindCond;
  const areaExpr = sql<string>`coalesce(${dailyTransactions.area}, '(Tanpa Area)')`;

  const rows = await db
    .select({
      area: areaExpr,
      sales: sql<string>`coalesce(sum(${dailyTransactions.total}), 0)`,
      transactions: count(),
    })
    .from(dailyTransactions)
    .where(combined)
    .groupBy(areaExpr);

  return rows
    .map((r) => ({ area: r.area, sales: Number(r.sales), transactions: Number(r.transactions) }))
    .sort((a, b) => b.sales - a.sales);
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
