import type { SiteKpiAggregate } from "@/db/repositories/daily-transaction-repository";
import type { OutstandingAggregate } from "@/db/repositories/invoice-repository";

export type KpiSummary = {
  sales: number;
  cost: number;
  profit: number;
  marginPct: number;
  transactions: number;
  siteCount: number;
  outstandingCount: number;
  outstandingAmount: number;
  overdueCount: number;
  overdueAmount: number;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Fold per-site aggregates and outstanding-invoice aggregates into a single
 * headline KPI summary for the KPI Utama Site widget. Margin is gross profit as
 * a percentage of sales (0 when there are no sales).
 */
export function buildKpiSummary(
  sites: SiteKpiAggregate[],
  outstanding: OutstandingAggregate,
): KpiSummary {
  let sales = 0;
  let cost = 0;
  let transactions = 0;
  for (const s of sites) {
    sales += s.sales;
    cost += s.cost;
    transactions += s.transactions;
  }
  const profit = sales - cost;
  const marginPct = sales > 0 ? round2((profit / sales) * 100) : 0;

  return {
    sales: round2(sales),
    cost: round2(cost),
    profit: round2(profit),
    marginPct,
    transactions,
    siteCount: sites.length,
    outstandingCount: outstanding.outstandingCount,
    outstandingAmount: round2(outstanding.outstandingAmount),
    overdueCount: outstanding.overdueCount,
    overdueAmount: round2(outstanding.overdueAmount),
  };
}
