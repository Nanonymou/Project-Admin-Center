import { NextResponse, type NextRequest } from "next/server";
import { type DashboardFilter, type SiteKpiAggregate } from "@/db/repositories/daily-transaction-repository";
import { cachedByPeriod, cachedSalesCostBySite } from "@/lib/server/kpi-cache";
import { computeKpiStatus } from "@/lib/server/services/kpi-status-service";
import { authorizeDashboard, requirePersona } from "@/lib/server/rbac";
import { parsePeriod } from "@/lib/server/period";
import { canAccessLocation } from "@/lib/personas";
import { getMarginModel, getMarginTarget, marginModelLabel } from "@/lib/mock/margin-model";
import { SITE_KPI, scaleSiteKpisByPeriod } from "@/lib/mock/site-kpi";
import { buildProfitTrendForRange } from "@/lib/mock/margin-data";

export const dynamic = "force-dynamic";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

type Row = { projectCode: string; locationId: string; locationName?: string; sales: number; cost: number };
type Point = { period: string; sales: number; cost: number; profit: number };

/** Compose summary + per-location comparison + margin trend from raw rows. */
function build(rows: Row[], trendPts: Point[], projectId: string | undefined) {
  const target = getMarginTarget(projectId);
  const model = projectId ? getMarginModel(projectId) : "standard";

  const totalSales = rows.reduce((s, r) => s + r.sales, 0);
  const totalCost = rows.reduce((s, r) => s + r.cost, 0);
  const totalProfit = totalSales - totalCost;
  const overallMargin = totalSales > 0 ? round2((totalProfit / totalSales) * 100) : 0;

  const avgMargin =
    rows.length > 0
      ? round2(
          rows.reduce((s, r) => s + (r.sales > 0 ? ((r.sales - r.cost) / r.sales) * 100 : 0), 0) /
            rows.length,
        )
      : 0;

  const comparison = rows
    .map((r) => {
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
        sharePct: totalSales > 0 ? round2((r.sales / totalSales) * 100) : 0,
        deltaVsAvgPct: round2(marginPct - avgMargin),
        status: computeKpiStatus(marginPct, target),
        rank: 0,
      };
    })
    .sort((a, b) => b.marginPct - a.marginPct)
    .map((r, i) => ({ ...r, rank: i + 1 }));

  const trend = trendPts.map((p) => ({
    period: p.period,
    sales: round2(p.sales),
    cost: round2(p.cost),
    profit: round2(p.profit),
    marginPct: p.sales > 0 ? round2((p.profit / p.sales) * 100) : 0,
  }));

  return {
    model,
    modelLabel: marginModelLabel(model),
    target,
    summary: {
      sales: round2(totalSales),
      cost: round2(totalCost),
      profit: round2(totalProfit),
      marginPct: overallMargin,
      siteCount: rows.length,
      status: computeKpiStatus(overallMargin, target),
    },
    comparison,
    trend,
  };
}

/**
 * GET /api/margin/dashboard?projectId=&locationId=&granularity=day|month&period=&from=&to=&scope=
 * Consolidated Margin Dashboard payload: headline summary, per-location
 * comparison, and the margin trend — honouring the project's margin model and
 * scoped to the persona. Falls back to mock data when the DB is unavailable.
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

  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;
  const authz = authorizeDashboard(persona, filter);
  if (!authz.ok) {
    return NextResponse.json({ error: authz.message, role: persona.role }, { status: authz.status });
  }

  try {
    const rows: Row[] = (await cachedSalesCostBySite(filter))
      .filter((s: SiteKpiAggregate) => canAccessLocation(persona, s.locationId, s.projectId))
      .map((s) => ({ projectCode: s.projectId, locationId: s.locationId, sales: s.sales, cost: s.cost }));
    const trend = await cachedByPeriod(filter, granularity);
    return NextResponse.json({ source: "db", filter, ...build(rows, trend, projectId) });
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
    const from = filter.from ?? new Date(Date.now() - 180 * 86_400_000).toISOString().slice(0, 10);
    const to = filter.to ?? new Date().toISOString().slice(0, 10);
    const trend = buildProfitTrendForRange(mock, from, to).map((p) => ({
      period: p.month,
      sales: p.sales,
      cost: p.cost,
      profit: p.profit,
    }));
    return NextResponse.json({ source: "mock", filter, ...build(rows, trend, projectId) });
  }
}
