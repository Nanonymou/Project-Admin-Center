import type { PeriodPoint } from "@/db/repositories/daily-transaction-repository";

/** KPI health status derived from margin vs. the project's target margin. */
export type KpiStatus = "healthy" | "warning" | "critical";

export const KPI_STATUS_META: Record<KpiStatus, { label: string; variant: "success" | "warning" | "danger" }> = {
  healthy: { label: "Sehat", variant: "success" },
  warning: { label: "Perlu Perhatian", variant: "warning" },
  critical: { label: "Kritis", variant: "danger" },
};

/**
 * Classify KPI health: healthy when margin meets the target, warning when it is
 * within 60% of the target, critical below that. Thresholds are expressed
 * relative to the target so a project's config-driven target drives the bands.
 */
export function computeKpiStatus(marginPct: number, targetPct: number): KpiStatus {
  if (marginPct >= targetPct) return "healthy";
  if (marginPct >= targetPct * 0.6) return "warning";
  return "critical";
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export type MonthlyTotal = {
  period: string; // YYYY-MM
  sales: number;
  cost: number;
  profit: number;
  marginPct: number;
};

export type MonthlyTotalsResult = {
  months: MonthlyTotal[];
  current: MonthlyTotal | null;
  previous: MonthlyTotal | null;
  salesGrowthPct: number; // month-over-month
  profitGrowthPct: number;
};

function growth(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 100;
  return round2(((current - previous) / Math.abs(previous)) * 100);
}

/**
 * Roll period points up into monthly totals (bucketing by YYYY-MM so both day-
 * and month-granularity inputs work), then compute the current month, the
 * previous month, and month-over-month growth for sales and profit.
 */
export function computeMonthlyTotals(points: PeriodPoint[]): MonthlyTotalsResult {
  const map = new Map<string, MonthlyTotal>();
  for (const p of points) {
    const key = p.period.slice(0, 7); // YYYY-MM
    const entry = map.get(key) ?? { period: key, sales: 0, cost: 0, profit: 0, marginPct: 0 };
    entry.sales += p.sales;
    entry.cost += p.cost;
    entry.profit += p.profit;
    map.set(key, entry);
  }

  const months = Array.from(map.values())
    .map((m) => ({
      ...m,
      sales: round2(m.sales),
      cost: round2(m.cost),
      profit: round2(m.profit),
      marginPct: m.sales > 0 ? round2((m.profit / m.sales) * 100) : 0,
    }))
    .sort((a, b) => (a.period < b.period ? -1 : 1));

  const current = months.length ? months[months.length - 1] : null;
  const previous = months.length > 1 ? months[months.length - 2] : null;

  return {
    months,
    current,
    previous,
    salesGrowthPct: current && previous ? growth(current.sales, previous.sales) : 0,
    profitGrowthPct: current && previous ? growth(current.profit, previous.profit) : 0,
  };
}
