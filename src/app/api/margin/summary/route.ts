import { NextResponse, type NextRequest } from "next/server";
import { type DashboardFilter } from "@/db/repositories/daily-transaction-repository";
import { cachedSalesCostBySite } from "@/lib/server/kpi-cache";
import { computeKpiStatus } from "@/lib/server/services/kpi-status-service";
import { authorizeDashboard, getPersonaFromHeaders } from "@/lib/server/rbac";
import { parsePeriod } from "@/lib/server/period";
import { canAccessLocation } from "@/lib/personas";
import { getMarginModel, getMarginTarget, marginModelLabel } from "@/lib/mock/margin-model";
import { SITE_KPI, scaleSiteKpisByPeriod } from "@/lib/mock/site-kpi";

export const dynamic = "force-dynamic";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

type Row = { projectCode: string; locationId: string; locationName?: string; sales: number; cost: number };

function marginOf(sales: number, cost: number) {
  const profit = sales - cost;
  return {
    sales: round2(sales),
    cost: round2(cost),
    profit: round2(profit),
    marginPct: sales > 0 ? round2((profit / sales) * 100) : 0,
  };
}

/**
 * Build a config-driven margin summary. The project's margin model decides the
 * shape: "per_location" (e.g. PHSS) reports each location's margin independently;
 * "standard" aggregates at the project level. Every row also carries a health
 * status derived from the project's target margin. Fully generic — no
 * project-named branches; behaviour follows getMarginModel keyed by code.
 */
function summarize(rows: Row[], projectId: string | undefined) {
  const target = getMarginTarget(projectId);
  const model = projectId ? getMarginModel(projectId) : "standard";

  const overall = marginOf(
    rows.reduce((s, r) => s + r.sales, 0),
    rows.reduce((s, r) => s + r.cost, 0),
  );

  const byLocation = rows
    .map((r) => {
      const m = marginOf(r.sales, r.cost);
      return {
        projectCode: r.projectCode,
        locationId: r.locationId,
        locationName: r.locationName,
        ...m,
        status: computeKpiStatus(m.marginPct, target),
      };
    })
    .sort((a, b) => b.profit - a.profit);

  // For a standard (project-level) model, roll locations up per project too.
  const byProjectMap = new Map<string, { projectCode: string; sales: number; cost: number }>();
  for (const r of rows) {
    const entry = byProjectMap.get(r.projectCode) ?? { projectCode: r.projectCode, sales: 0, cost: 0 };
    entry.sales += r.sales;
    entry.cost += r.cost;
    byProjectMap.set(r.projectCode, entry);
  }
  const byProject = Array.from(byProjectMap.values()).map((p) => {
    const m = marginOf(p.sales, p.cost);
    return { projectCode: p.projectCode, ...m, status: computeKpiStatus(m.marginPct, getMarginTarget(p.projectCode)) };
  });

  return {
    model,
    modelLabel: marginModelLabel(model),
    target,
    overall: { ...overall, status: computeKpiStatus(overall.marginPct, target) },
    byLocation,
    byProject,
  };
}

/**
 * GET /api/margin/summary?projectId=&locationId=&period=&from=&to=&scope=
 * Config-driven margin summary honouring the project's margin model, scoped to
 * the persona. Falls back to mock data when the database is unavailable.
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
    return NextResponse.json({ source: "db", filter, ...summarize(rows, projectId) });
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
    return NextResponse.json({ source: "mock", filter, ...summarize(rows, projectId) });
  }
}
