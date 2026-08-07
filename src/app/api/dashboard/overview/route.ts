import { NextResponse, type NextRequest } from "next/server";
import { type DashboardFilter } from "@/db/repositories/daily-transaction-repository";
import { cachedByPeriod, cachedSalesCostBySite } from "@/lib/server/kpi-cache";
import { authorizeDashboard, getPersonaFromHeaders } from "@/lib/server/rbac";
import { parsePeriod } from "@/lib/server/period";
import { canAccessLocation } from "@/lib/personas";
import { getMarginTarget } from "@/lib/mock/margin-model";
import { SITE_KPI, scaleSiteKpisByPeriod } from "@/lib/mock/site-kpi";
import { buildProfitTrendForRange } from "@/lib/mock/margin-data";

export const dynamic = "force-dynamic";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

type SiteRow = { projectCode: string; locationId: string; sales: number; cost: number; profit: number };

function totalsOf(sites: SiteRow[]) {
  const sales = sites.reduce((s, r) => s + r.sales, 0);
  const cost = sites.reduce((s, r) => s + r.cost, 0);
  const profit = sales - cost;
  return {
    sales: round2(sales),
    cost: round2(cost),
    profit: round2(profit),
    marginPct: sales > 0 ? round2((profit / sales) * 100) : 0,
    siteCount: sites.length,
  };
}

/**
 * GET /api/dashboard/overview
 *   ?projectId=&locationId=&granularity=day|month&period=&from=&to=&scope=
 *
 * The Filter Global Dashboard data endpoint: portfolio totals, per-site KPIs,
 * and a trend series — all honouring the active global filters (project,
 * location, period) and the caller's persona scope. Falls back to mock data when
 * the database is unavailable.
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
    const sites: SiteRow[] = (await cachedSalesCostBySite(filter))
      .filter((s) => canAccessLocation(persona, s.locationId, s.projectId))
      .map((s) => ({
        projectCode: s.projectId,
        locationId: s.locationId,
        sales: round2(s.sales),
        cost: round2(s.cost),
        profit: round2(s.profit),
      }));
    const trend = (await cachedByPeriod(filter, granularity)).map((p) => ({
      period: p.period,
      sales: round2(p.sales),
      cost: round2(p.cost),
      profit: round2(p.profit),
    }));
    return NextResponse.json({
      source: "db",
      filter,
      period: period.label,
      target,
      totals: totalsOf(sites),
      sites: sites.sort((a, b) => b.profit - a.profit),
      trend,
    });
  } catch {
    let rows = SITE_KPI.filter((s) => canAccessLocation(persona, s.locationId, s.projectCode));
    if (projectId) rows = rows.filter((r) => r.projectCode === projectId);
    if (filter.locationId) rows = rows.filter((r) => r.locationId === filter.locationId);
    if (filter.from && filter.to) rows = scaleSiteKpisByPeriod(rows, filter.from, filter.to);

    const sites: SiteRow[] = rows.map((r) => ({
      projectCode: r.projectCode,
      locationId: r.locationId,
      sales: r.sales,
      cost: r.cost,
      profit: r.sales - r.cost,
    }));
    const from = filter.from ?? new Date(Date.now() - 180 * 86_400_000).toISOString().slice(0, 10);
    const to = filter.to ?? new Date().toISOString().slice(0, 10);
    const trend = buildProfitTrendForRange(rows, from, to).map((p) => ({
      period: p.month,
      sales: p.sales,
      cost: p.cost,
      profit: p.profit,
    }));
    return NextResponse.json({
      source: "mock",
      filter,
      period: period.label,
      target,
      totals: totalsOf(sites),
      sites: sites.sort((a, b) => b.profit - a.profit),
      trend,
    });
  }
}
