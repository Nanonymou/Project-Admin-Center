import { NextResponse, type NextRequest } from "next/server";
import { type DashboardFilter, type PeriodPoint } from "@/db/repositories/daily-transaction-repository";
import { cachedByPeriod, cachedSalesCostBySite } from "@/lib/server/kpi-cache";
import { authorizeDashboard, getPersonaFromHeaders } from "@/lib/server/rbac";
import { parsePeriod } from "@/lib/server/period";
import { canAccessLocation } from "@/lib/personas";
import { getMarginModel } from "@/lib/mock/margin-model";
import { SITE_KPI, scaleSiteKpisByPeriod } from "@/lib/mock/site-kpi";
import { buildProfitTrendForRange } from "@/lib/mock/margin-data";

export const dynamic = "force-dynamic";

const MAX_LOCATION_SERIES = 12;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Add marginPct to each period point (0 when there are no sales). */
function withMargin(points: PeriodPoint[]) {
  return points.map((p) => ({
    period: p.period,
    sales: round2(p.sales),
    cost: round2(p.cost),
    profit: round2(p.profit),
    marginPct: p.sales > 0 ? round2((p.profit / p.sales) * 100) : 0,
  }));
}

/**
 * GET /api/margin/trend?projectId=&locationId=&granularity=day|month&period=&from=&to=&scope=
 * Margin trend over time (marginPct per period), scoped to the persona. For a
 * project whose margin model is "per_location" (e.g. PHSS) and no single location
 * is selected, per-location trend series are also returned so each site can be
 * charted independently. Falls back to mock data when the DB is unavailable.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const projectId = sp.get("projectId") ?? undefined;
  const locationId = sp.get("locationId") ?? undefined;
  const period = parsePeriod(sp, undefined, projectId);
  const granularity = sp.get("granularity") === "day" ? "day" : "month";
  const scope = (sp.get("scope") as "tenant" | "executive" | null) ?? (projectId ? "tenant" : "executive");
  const filter: DashboardFilter = { projectId, locationId, from: period.from, to: period.to, scope };

  const persona = getPersonaFromHeaders(req.headers);
  const authz = authorizeDashboard(persona, filter);
  if (!authz.ok) {
    return NextResponse.json({ error: authz.message, role: persona.role }, { status: authz.status });
  }
  const model = projectId ? getMarginModel(projectId) : "standard";
  const wantPerLocation = model === "per_location" && !locationId;

  try {
    const overall = withMargin(await cachedByPeriod(filter, granularity));

    let byLocation: { locationId: string; projectCode: string; trend: ReturnType<typeof withMargin> }[] = [];
    if (wantPerLocation) {
      const sites = (await cachedSalesCostBySite(filter))
        .filter((s) => canAccessLocation(persona, s.locationId, s.projectId))
        .slice(0, MAX_LOCATION_SERIES);
      byLocation = await Promise.all(
        sites.map(async (s) => ({
          locationId: s.locationId,
          projectCode: s.projectId,
          trend: withMargin(await cachedByPeriod({ ...filter, locationId: s.locationId }, granularity)),
        })),
      );
    }

    return NextResponse.json({ source: "db", filter, model, granularity, overall, byLocation });
  } catch {
    let rows = SITE_KPI.filter((s) => canAccessLocation(persona, s.locationId, s.projectCode));
    if (projectId) rows = rows.filter((r) => r.projectCode === projectId);
    if (locationId) rows = rows.filter((r) => r.locationId === locationId);
    if (filter.from && filter.to) rows = scaleSiteKpisByPeriod(rows, filter.from, filter.to);

    const from = filter.from ?? new Date(Date.now() - 180 * 86_400_000).toISOString().slice(0, 10);
    const to = filter.to ?? new Date().toISOString().slice(0, 10);
    const toPts = (arr: ReturnType<typeof buildProfitTrendForRange>) =>
      withMargin(arr.map((p) => ({ period: p.month, sales: p.sales, cost: p.cost, profit: p.profit })));

    const overall = toPts(buildProfitTrendForRange(rows, from, to));
    const byLocation = wantPerLocation
      ? rows.slice(0, MAX_LOCATION_SERIES).map((r) => ({
          locationId: r.locationId,
          projectCode: r.projectCode,
          trend: toPts(buildProfitTrendForRange([r], from, to)),
        }))
      : [];

    return NextResponse.json({ source: "mock", filter, model, granularity, overall, byLocation });
  }
}
