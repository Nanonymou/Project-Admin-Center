import {
  aggregateKpisBySite,
  type DashboardFilter,
  type SiteKpiAggregate,
} from "@/db/repositories/daily-transaction-repository";

export type RankMetric = "sales" | "profit" | "marginPct";

export type RankedSite = SiteKpiAggregate & { marginPct: number; rank: number };

export function isRankMetric(v: string | null | undefined): v is RankMetric {
  return v === "sales" || v === "profit" || v === "marginPct";
}

/**
 * Pure ranking logic — assign a margin % and 1-based rank to each site by the
 * chosen metric. Reused by both the DB path and the mock fallback.
 */
export function rankList<T extends SiteKpiAggregate>(sites: T[], metric: RankMetric): (T & RankedSite)[] {
  const withMargin = sites.map((s) => ({
    ...s,
    marginPct: s.sales > 0 ? (s.profit / s.sales) * 100 : 0,
  }));
  withMargin.sort((a, b) => (b[metric] as number) - (a[metric] as number));
  return withMargin.map((s, i) => ({ ...s, rank: i + 1 }));
}

/** Rank sites from the database by the given metric. */
export async function rankSites(filter: DashboardFilter, metric: RankMetric = "sales"): Promise<RankedSite[]> {
  const sites = await aggregateKpisBySite(filter);
  return rankList(sites, metric);
}
