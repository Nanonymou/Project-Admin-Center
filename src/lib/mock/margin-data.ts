import type { ProfitTrendPoint } from "@/components/margin/profit-trend-chart";
import type { SiteKpi } from "./site-kpi";

/**
 * Build a 12-month portfolio profit trend from the given sites. Monthly
 * totals are the sum of per-site sales/cost with a seeded seasonal wave.
 */
export function buildProfitTrend(sites: SiteKpi[]): ProfitTrendPoint[] {
  const totalSales = sites.reduce((s, x) => s + x.sales, 0);
  const totalCost = sites.reduce((s, x) => s + x.cost, 0);
  const out: ProfitTrendPoint[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    const wave = 0.85 + Math.sin((11 - i) / 2) * 0.12 + ((i * 7) % 10) / 100;
    const sales = Math.round(totalSales * wave);
    const cost = Math.round(totalCost * wave * (0.95 + ((i * 3) % 8) / 100));
    const profit = sales - cost;
    out.push({
      month: d.toLocaleDateString("id-ID", { month: "short", year: "2-digit" }),
      sales,
      cost,
      profit,
      marginPct: sales === 0 ? 0 : (profit / sales) * 100,
    });
  }
  return out;
}

/**
 * Build a profit trend for an explicit date range. If the range spans <= 62
 * days it produces daily points; otherwise monthly buckets. Totals are
 * distributed across the range so the chart tracks the selected period.
 */
export function buildProfitTrendForRange(
  sites: SiteKpi[],
  fromIso: string,
  toIso: string,
): ProfitTrendPoint[] {
  const from = new Date(`${fromIso}T00:00:00Z`);
  const to = new Date(`${toIso}T00:00:00Z`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) {
    return buildProfitTrend(sites);
  }
  const dayMs = 86_400_000;
  const totalDays = Math.max(1, Math.round((to.getTime() - from.getTime()) / dayMs) + 1);
  const totalSales = sites.reduce((s, x) => s + x.sales, 0);
  const totalCost = sites.reduce((s, x) => s + x.cost, 0);

  const daily = totalDays <= 62;
  const points: ProfitTrendPoint[] = [];

  if (daily) {
    const perDaySales = totalSales / totalDays;
    const perDayCost = totalCost / totalDays;
    for (let i = 0; i < totalDays; i++) {
      const d = new Date(from.getTime() + i * dayMs);
      const wave = 0.8 + Math.sin(i / 3) * 0.15 + ((i * 7) % 10) / 100;
      const sales = Math.round(perDaySales * wave);
      const cost = Math.round(perDayCost * wave * (0.95 + ((i * 3) % 8) / 100));
      const profit = sales - cost;
      points.push({
        month: d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" }),
        sales,
        cost,
        profit,
        marginPct: sales === 0 ? 0 : (profit / sales) * 100,
      });
    }
  } else {
    // monthly buckets across the range
    const cursor = new Date(from.getFullYear(), from.getMonth(), 1);
    const months: Date[] = [];
    while (cursor <= to) {
      months.push(new Date(cursor));
      cursor.setMonth(cursor.getMonth() + 1);
    }
    const perMonthSales = totalSales / months.length;
    const perMonthCost = totalCost / months.length;
    months.forEach((m, i) => {
      const wave = 0.85 + Math.sin(i / 2) * 0.12 + ((i * 7) % 10) / 100;
      const sales = Math.round(perMonthSales * wave);
      const cost = Math.round(perMonthCost * wave * (0.95 + ((i * 3) % 8) / 100));
      const profit = sales - cost;
      points.push({
        month: m.toLocaleDateString("id-ID", { month: "short", year: "2-digit" }),
        sales,
        cost,
        profit,
        marginPct: sales === 0 ? 0 : (profit / sales) * 100,
      });
    });
  }
  return points;
}

export type MarginBySite = {
  locationId: string;
  label: string;
  projectCode: string;
  sales: number;
  profit: number;
  marginPct: number;
};

export function buildMarginBySite(sites: SiteKpi[]): MarginBySite[] {
  return sites
    .map((s) => ({
      locationId: s.locationId,
      label: `${s.projectCode} · ${s.locationName}`,
      projectCode: s.projectCode,
      sales: s.sales,
      profit: s.netMargin,
      marginPct: s.marginPct,
    }))
    .sort((a, b) => b.profit - a.profit);
}
