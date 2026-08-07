import { NextResponse, type NextRequest } from "next/server";
import { type DashboardFilter } from "@/db/repositories/daily-transaction-repository";
import { cachedSalesCostBySite } from "@/lib/server/kpi-cache";
import { rankList, isRankMetric, type RankMetric } from "@/lib/server/services/ranking-service";
import { authorizeDashboard, getPersonaFromHeaders } from "@/lib/server/rbac";
import { parsePeriod } from "@/lib/server/period";
import { canAccessLocation } from "@/lib/personas";
import { SITE_KPI, scaleSiteKpisByPeriod } from "@/lib/mock/site-kpi";

export const dynamic = "force-dynamic";

/**
 * GET /api/top-performance?metric=sales|profit|marginPct&limit=5&projectId=&from=&to=&scope=
 * Top-N performing sites by the chosen metric (default profit, top 5), scoped to
 * the persona, with the aggregate portfolio totals. Also returns the bottom-N
 * for a quick "who needs attention" view. Falls back to mock data when the
 * database is unavailable.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const projectId = sp.get("projectId") ?? undefined;
  const period = parsePeriod(sp, undefined, projectId);
  const metric: RankMetric = isRankMetric(sp.get("metric")) ? (sp.get("metric") as RankMetric) : "profit";
  const limitRaw = Number(sp.get("limit"));
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 50) : 5;
  const scope = (sp.get("scope") as "tenant" | "executive" | null) ?? (projectId ? "tenant" : "executive");
  // Multi-site selection: `sites=loc1,loc2` narrows to a subset; `locationId`
  // remains supported for a single site. An empty set means "no restriction".
  const siteSet = new Set(
    (sp.get("sites") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
  const filter: DashboardFilter = {
    projectId,
    locationId: sp.get("locationId") ?? undefined,
    from: period.from,
    to: period.to,
    scope,
  };
  const inSiteSet = (locationId: string) => siteSet.size === 0 || siteSet.has(locationId);

  const persona = getPersonaFromHeaders(req.headers);
  const authz = authorizeDashboard(persona, filter);
  if (!authz.ok) {
    return NextResponse.json({ error: authz.message, role: persona.role }, { status: authz.status });
  }

  try {
    const aggregates = (await cachedSalesCostBySite(filter)).filter(
      (s) => canAccessLocation(persona, s.locationId, s.projectId) && inSiteSet(s.locationId),
    );
    const ranked = rankList(aggregates, metric);
    return NextResponse.json({
      source: "db",
      metric,
      limit,
      filter,
      top: ranked.slice(0, limit),
      bottom: ranked.slice(-limit).reverse(),
    });
  } catch {
    let rows = SITE_KPI.filter((s) => canAccessLocation(persona, s.locationId, s.projectCode));
    if (projectId) rows = rows.filter((r) => r.projectCode === projectId);
    if (filter.locationId) rows = rows.filter((r) => r.locationId === filter.locationId);
    rows = rows.filter((r) => inSiteSet(r.locationId));
    if (filter.from && filter.to) rows = scaleSiteKpisByPeriod(rows, filter.from, filter.to);

    const aggregates = rows.map((r) => ({
      projectId: r.projectCode,
      locationId: r.locationId,
      locationName: r.locationName,
      sales: r.sales,
      cost: r.cost,
      profit: r.sales - r.cost,
      transactions: 0,
    }));
    const ranked = rankList(aggregates, metric);
    return NextResponse.json({
      source: "mock",
      metric,
      limit,
      filter,
      top: ranked.slice(0, limit),
      bottom: ranked.slice(-limit).reverse(),
    });
  }
}
