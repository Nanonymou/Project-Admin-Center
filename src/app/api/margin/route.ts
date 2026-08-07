import { NextResponse, type NextRequest } from "next/server";
import { type DashboardFilter } from "@/db/repositories/daily-transaction-repository";
import { cachedByPeriod, cachedSalesCostBySite } from "@/lib/server/kpi-cache";
import { computeKpiStatus } from "@/lib/server/services/kpi-status-service";
import { authorizeDashboard, getPersonaFromHeaders } from "@/lib/server/rbac";
import { parsePeriod } from "@/lib/server/period";
import { canAccessLocation } from "@/lib/personas";
import { getMarginTarget } from "@/lib/mock/margin-model";
import { SITE_KPI, scaleSiteKpisByPeriod } from "@/lib/mock/site-kpi";
import { buildMarginBySite, buildProfitTrendForRange } from "@/lib/mock/margin-data";

export const dynamic = "force-dynamic";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * GET /api/margin?projectId=&locationId=&granularity=day|month&period=&from=&to=&scope=
 * Profit/margin per site plus a profit trend series for the Dashboard Margin
 * page — scoped to the persona. Each site carries a KPI health status derived
 * from the project's config-driven margin target. Falls back to mock margin
 * data when the database is unavailable.
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
  const target = getMarginTarget(projectId);

  try {
    const sites = (await cachedSalesCostBySite(filter)).filter((s) =>
      canAccessLocation(persona, s.locationId, s.projectId),
    );
    const perSite = sites
      .map((s) => {
        const marginPct = s.sales > 0 ? round2((s.profit / s.sales) * 100) : 0;
        return {
          projectCode: s.projectId,
          locationId: s.locationId,
          sales: round2(s.sales),
          cost: round2(s.cost),
          profit: round2(s.profit),
          marginPct,
          status: computeKpiStatus(marginPct, target),
        };
      })
      .sort((a, b) => b.profit - a.profit);

    const trend = (await cachedByPeriod(filter, granularity)).map((p) => ({
      period: p.period,
      sales: round2(p.sales),
      cost: round2(p.cost),
      profit: round2(p.profit),
    }));

    return NextResponse.json({ source: "db", filter, target, perSite, trend });
  } catch {
    let rows = SITE_KPI.filter((s) => canAccessLocation(persona, s.locationId, s.projectCode));
    if (projectId) rows = rows.filter((r) => r.projectCode === projectId);
    if (filter.locationId) rows = rows.filter((r) => r.locationId === filter.locationId);
    if (filter.from && filter.to) rows = scaleSiteKpisByPeriod(rows, filter.from, filter.to);

    const perSite = buildMarginBySite(rows).map((m) => ({
      projectCode: m.projectCode,
      locationId: m.locationId,
      label: m.label,
      sales: m.sales,
      profit: m.profit,
      marginPct: m.marginPct,
      status: computeKpiStatus(m.marginPct, target),
    }));

    const from = filter.from ?? new Date(Date.now() - 180 * 86_400_000).toISOString().slice(0, 10);
    const to = filter.to ?? new Date().toISOString().slice(0, 10);
    const trend = buildProfitTrendForRange(rows, from, to).map((p) => ({
      period: p.month,
      sales: p.sales,
      cost: p.cost,
      profit: p.profit,
    }));

    return NextResponse.json({ source: "mock", filter, target, perSite, trend });
  }
}
