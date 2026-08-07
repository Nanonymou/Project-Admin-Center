import {
  aggregateKpisBySite,
  type DashboardFilter,
  type SiteKpiAggregate,
} from "@/db/repositories/daily-transaction-repository";

export type RankMetric = "sales" | "profit" | "marginPct";

export type RankedSite = SiteKpiAggregate & {
  marginPct: number;
  rank: number;
  /** This site's share of the total metric value (%). */
  share: number;
  /** Running cumulative share up to and including this rank (%), for Pareto. */
  cumulativeShare: number;
};

export function isRankMetric(v: string | null | undefined): v is RankMetric {
  return v === "sales" || v === "profit" || v === "marginPct";
}

/**
 * Pure ranking logic — assign margin %, 1-based rank, and each site's share &
 * cumulative share of the chosen metric (a Pareto/contribution view that makes
 * profit ranking especially useful). Reused by DB and mock paths.
 */
export function rankList<T extends SiteKpiAggregate>(sites: T[], metric: RankMetric): (T & RankedSite)[] {
  const withMargin = sites.map((s) => ({
    ...s,
    marginPct: s.sales > 0 ? (s.profit / s.sales) * 100 : 0,
  }));
  withMargin.sort((a, b) => (b[metric] as number) - (a[metric] as number));

  const total = withMargin.reduce((sum, s) => sum + Math.max(0, s[metric] as number), 0);
  let cumulative = 0;
  return withMargin.map((s, i) => {
    const value = Math.max(0, s[metric] as number);
    const share = total > 0 ? (value / total) * 100 : 0;
    cumulative += share;
    return { ...s, rank: i + 1, share, cumulativeShare: cumulative };
  });
}

/** Rank sites from the database by the given metric. */
export async function rankSites(filter: DashboardFilter, metric: RankMetric = "sales"): Promise<RankedSite[]> {
  const sites = await aggregateKpisBySite(filter);
  return rankList(sites, metric);
}
