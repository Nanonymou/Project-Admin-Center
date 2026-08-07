import type { SiteKpiAggregate, SiteSubmissionStatus } from "@/db/repositories/daily-transaction-repository";

export type ProjectPerformance = {
  projectCode: string;
  sales: number;
  cost: number;
  profit: number;
  marginPct: number;
  siteCount: number;
  /** Total submissions and on-time (non-late) share, as a compliance rate 0–100. */
  submissions: number;
  onTimeSubmissions: number;
  complianceRate: number;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Fold per-site KPI aggregates and per-site submission status into per-project
 * performance: margin (gross profit ÷ sales) and submission compliance (share of
 * submissions that were not late). Both inputs are keyed by site; a project's
 * figures are the sum across its sites. Pure and config-agnostic.
 */
export function buildProjectPerformance(
  kpis: SiteKpiAggregate[],
  submissions: SiteSubmissionStatus[],
): ProjectPerformance[] {
  const subByLoc = new Map(submissions.map((s) => [`${s.projectId}|${s.locationId}`, s]));

  const map = new Map<
    string,
    { sales: number; cost: number; sites: Set<string>; total: number; late: number }
  >();
  for (const k of kpis) {
    const entry =
      map.get(k.projectId) ?? { sales: 0, cost: 0, sites: new Set<string>(), total: 0, late: 0 };
    entry.sales += k.sales;
    entry.cost += k.cost;
    entry.sites.add(k.locationId);
    const sub = subByLoc.get(`${k.projectId}|${k.locationId}`);
    if (sub) {
      entry.total += sub.total;
      entry.late += sub.late;
    }
    map.set(k.projectId, entry);
  }

  return Array.from(map.entries())
    .map(([projectCode, e]) => {
      const profit = e.sales - e.cost;
      const onTime = Math.max(0, e.total - e.late);
      return {
        projectCode,
        sales: round2(e.sales),
        cost: round2(e.cost),
        profit: round2(profit),
        marginPct: e.sales > 0 ? round2((profit / e.sales) * 100) : 0,
        siteCount: e.sites.size,
        submissions: e.total,
        onTimeSubmissions: onTime,
        complianceRate: e.total > 0 ? round2((onTime / e.total) * 100) : 0,
      };
    })
    .sort((a, b) => b.profit - a.profit);
}
