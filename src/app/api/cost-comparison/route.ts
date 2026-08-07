import { NextResponse, type NextRequest } from "next/server";
import { type DashboardFilter } from "@/db/repositories/daily-transaction-repository";
import { cachedByPeriod, cachedSalesCostBySite } from "@/lib/server/kpi-cache";
import { authorizeDashboard, getPersonaFromHeaders } from "@/lib/server/rbac";
import { parsePeriod } from "@/lib/server/period";
import { canAccessLocation } from "@/lib/personas";
import { SITE_KPI, scaleSiteKpisByPeriod } from "@/lib/mock/site-kpi";
import { buildProfitTrendForRange } from "@/lib/mock/margin-data";

export const dynamic = "force-dynamic";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

type SiteCost = { projectCode: string; locationId: string; locationName?: string; cost: number };

/** Rank sites by cost, adding share-of-total and delta-vs-average. */
function compareCost(sites: SiteCost[]) {
  const totalCost = sites.reduce((s, r) => s + r.cost, 0);
  const avgCost = sites.length ? totalCost / sites.length : 0;
  const rows = sites
    .map((s) => ({
      projectCode: s.projectCode,
      locationId: s.locationId,
      locationName: s.locationName,
      cost: round2(s.cost),
      sharePct: totalCost > 0 ? round2((s.cost / totalCost) * 100) : 0,
      deltaVsAvgPct: avgCost > 0 ? round2(((s.cost - avgCost) / avgCost) * 100) : 0,
      rank: 0,
    }))
    .sort((a, b) => b.cost - a.cost)
    .map((r, i) => ({ ...r, rank: i + 1 }));
  return { totalCost: round2(totalCost), avgCost: round2(avgCost), siteCount: sites.length, rows };
}

/**
 * GET /api/cost-comparison?projectId=&locationId=&granularity=day|month&period=&from=&to=&scope=
 * Cost per site (ranked, with share and delta-vs-average) plus a cost trend over
 * the period, for the Cost Comparison chart — scoped to the persona. Falls back
 * to mock data when the database is unavailable.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const projectId = sp.get("projectId") ?? undefined;
  const period = parsePeriod(sp, undefined, projectId);
  const granularity = sp.get("granularity") === "day" ? "day" : "month";
  const scope = (sp.get("scope") as "tenant" | "executive" | null) ?? (projectId ? "tenant" : "executive");
  const filter: DashboardFilter = {
    projectId,
    locationId: sp.get("locationId") ?? undefined,
    from: period.from,
    to: period.to,
    scope,
  };

  const persona = getPersonaFromHeaders(req.headers);
  const authz = authorizeDashboard(persona, filter);
  if (!authz.ok) {
    return NextResponse.json({ error: authz.message, role: persona.role }, { status: authz.status });
  }

  try {
    const sites: SiteCost[] = (await cachedSalesCostBySite(filter))
      .filter((s) => canAccessLocation(persona, s.locationId, s.projectId))
      .map((s) => ({ projectCode: s.projectId, locationId: s.locationId, cost: s.cost }));
    const trend = (await cachedByPeriod(filter, granularity)).map((p) => ({
      period: p.period,
      cost: round2(p.cost),
    }));
    return NextResponse.json({ source: "db", filter, ...compareCost(sites), trend });
  } catch {
    let rows = SITE_KPI.filter((s) => canAccessLocation(persona, s.locationId, s.projectCode));
    if (projectId) rows = rows.filter((r) => r.projectCode === projectId);
    if (filter.locationId) rows = rows.filter((r) => r.locationId === filter.locationId);
    if (filter.from && filter.to) rows = scaleSiteKpisByPeriod(rows, filter.from, filter.to);

    const sites: SiteCost[] = rows.map((r) => ({
      projectCode: r.projectCode,
      locationId: r.locationId,
      locationName: r.locationName,
      cost: r.cost,
    }));
    const from = filter.from ?? new Date(Date.now() - 180 * 86_400_000).toISOString().slice(0, 10);
    const to = filter.to ?? new Date().toISOString().slice(0, 10);
    const trend = buildProfitTrendForRange(rows, from, to).map((p) => ({ period: p.month, cost: p.cost }));
    return NextResponse.json({ source: "mock", filter, ...compareCost(sites), trend });
  }
}
