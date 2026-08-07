import { NextResponse, type NextRequest } from "next/server";
import { type DashboardFilter } from "@/db/repositories/daily-transaction-repository";
import { cachedSalesCostBySite } from "@/lib/server/kpi-cache";
import { computeKpiStatus } from "@/lib/server/services/kpi-status-service";
import { authorizeDashboard, getPersonaFromHeaders } from "@/lib/server/rbac";
import { parsePeriod } from "@/lib/server/period";
import { canAccessLocation } from "@/lib/personas";
import { getMarginTarget } from "@/lib/mock/margin-model";
import { SITE_KPI, scaleSiteKpisByPeriod } from "@/lib/mock/site-kpi";

export const dynamic = "force-dynamic";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

type Row = { projectCode: string; locationId: string; locationName?: string; sales: number; cost: number };

/**
 * Compare locations side by side by sales, cost, profit, and margin, ranking
 * them and expressing each location's margin as a delta against the group
 * average — the "perbandingan lokasi" view (config-driven target for status).
 */
function compare(rows: Row[], projectId: string | undefined) {
  const target = getMarginTarget(projectId);
  const enriched = rows.map((r) => {
    const profit = r.sales - r.cost;
    const marginPct = r.sales > 0 ? round2((profit / r.sales) * 100) : 0;
    return {
      projectCode: r.projectCode,
      locationId: r.locationId,
      locationName: r.locationName,
      sales: round2(r.sales),
      cost: round2(r.cost),
      profit: round2(profit),
      marginPct,
      status: computeKpiStatus(marginPct, target),
    };
  });

  const avgMargin =
    enriched.length > 0 ? round2(enriched.reduce((s, r) => s + r.marginPct, 0) / enriched.length) : 0;

  const ranked = enriched
    .sort((a, b) => b.marginPct - a.marginPct)
    .map((r, i) => ({ ...r, rank: i + 1, deltaVsAvgPct: round2(r.marginPct - avgMargin) }));

  return {
    target,
    avgMargin,
    best: ranked[0] ?? null,
    worst: ranked.length ? ranked[ranked.length - 1] : null,
    locations: ranked,
  };
}

/**
 * GET /api/margin/compare?projectId=&period=&from=&to=&scope=
 * Location-vs-location margin comparison scoped to the persona. Falls back to
 * mock data when the database is unavailable.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const projectId = sp.get("projectId") ?? undefined;
  const period = parsePeriod(sp, undefined, projectId);
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
    const rows: Row[] = (await cachedSalesCostBySite(filter))
      .filter((s) => canAccessLocation(persona, s.locationId, s.projectId))
      .map((s) => ({ projectCode: s.projectId, locationId: s.locationId, sales: s.sales, cost: s.cost }));
    return NextResponse.json({ source: "db", filter, ...compare(rows, projectId) });
  } catch {
    let mock = SITE_KPI.filter((s) => canAccessLocation(persona, s.locationId, s.projectCode));
    if (projectId) mock = mock.filter((r) => r.projectCode === projectId);
    if (filter.locationId) mock = mock.filter((r) => r.locationId === filter.locationId);
    if (filter.from && filter.to) mock = scaleSiteKpisByPeriod(mock, filter.from, filter.to);
    const rows: Row[] = mock.map((r) => ({
      projectCode: r.projectCode,
      locationId: r.locationId,
      locationName: r.locationName,
      sales: r.sales,
      cost: r.cost,
    }));
    return NextResponse.json({ source: "mock", filter, ...compare(rows, projectId) });
  }
}
