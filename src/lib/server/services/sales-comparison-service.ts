import type { SiteKpiAggregate } from "@/db/repositories/daily-transaction-repository";

export type SalesComparisonRow = {
  projectCode: string;
  locationId: string;
  locationName?: string;
  sales: number;
  cost: number;
  profit: number;
  marginPct: number;
  /** Share of total sales across the compared set (0–100). */
  sharePct: number;
  /** Sales delta vs the group average, as a percentage of the average. */
  deltaVsAvgPct: number;
  rank: number;
};

export type SalesComparison = {
  totalSales: number;
  avgSales: number;
  siteCount: number;
  rows: SalesComparisonRow[];
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Aggregate sales per site into a comparison-ready shape for the "Grafik
 * Perbandingan Sales" chart: each site's sales/cost/profit/margin plus its share
 * of the total, its delta against the group average, and a sales rank. Pure and
 * config-agnostic — it consumes already-aggregated site rows (DB or mock) and
 * shapes them, so the same service backs both data sources.
 */
export function buildSalesComparison(
  sites: (SiteKpiAggregate & { locationName?: string })[],
): SalesComparison {
  const totalSales = sites.reduce((s, r) => s + r.sales, 0);
  const avgSales = sites.length ? totalSales / sites.length : 0;

  const rows = sites
    .map((s) => {
      const marginPct = s.sales > 0 ? round2((s.profit / s.sales) * 100) : 0;
      const sharePct = totalSales > 0 ? round2((s.sales / totalSales) * 100) : 0;
      const deltaVsAvgPct = avgSales > 0 ? round2(((s.sales - avgSales) / avgSales) * 100) : 0;
      return {
        projectCode: s.projectId,
        locationId: s.locationId,
        locationName: s.locationName,
        sales: round2(s.sales),
        cost: round2(s.cost),
        profit: round2(s.profit),
        marginPct,
        sharePct,
        deltaVsAvgPct,
        rank: 0,
      };
    })
    .sort((a, b) => b.sales - a.sales)
    .map((r, i) => ({ ...r, rank: i + 1 }));

  return {
    totalSales: round2(totalSales),
    avgSales: round2(avgSales),
    siteCount: sites.length,
    rows,
  };
}
