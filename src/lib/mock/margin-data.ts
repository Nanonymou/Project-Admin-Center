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
