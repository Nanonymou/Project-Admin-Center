import { NextResponse, type NextRequest } from "next/server";
import { aggregateDashboard, type DashboardFilter } from "@/db/repositories/daily-transaction-repository";
import { authorizeDashboard, getPersonaFromHeaders } from "@/lib/server/rbac";
import { parsePeriod } from "@/lib/server/period";
import { SITE_KPI, scaleSiteKpisByPeriod } from "@/lib/mock/site-kpi";

export const dynamic = "force-dynamic";

/**
 * GET /api/dashboard?projectId=&locationId=&from=&to=&scope=
 * Returns aggregated daily-transaction totals. Falls back to mock aggregation
 * when the database is unavailable so the endpoint always responds.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const projectId = sp.get("projectId") ?? undefined;
  const period = parsePeriod(sp);
  const filter: DashboardFilter = {
    projectId,
    locationId: sp.get("locationId") ?? undefined,
    from: period.from,
    to: period.to,
    scope: (sp.get("scope") as "tenant" | "executive" | null) ?? (projectId ? "tenant" : "executive"),
  };

  // Role & scope authorization (RBAC simulation via x-persona-id header).
  const persona = getPersonaFromHeaders(req.headers);
  const authz = authorizeDashboard(persona, filter);
  if (!authz.ok) {
    return NextResponse.json({ error: authz.message, role: persona.role }, { status: authz.status });
  }

  try {
    const data = await aggregateDashboard(filter);
    return NextResponse.json({ source: "db", filter, ...data });
  } catch {
    return NextResponse.json({ source: "mock", filter, ...mockAggregate(filter) });
  }
}

function mockAggregate(filter: DashboardFilter) {
  let rows = SITE_KPI.slice();
  if (filter.projectId) rows = rows.filter((r) => r.projectCode === filter.projectId);
  if (filter.locationId) rows = rows.filter((r) => r.locationId === filter.locationId);
  if (filter.from && filter.to) rows = scaleSiteKpisByPeriod(rows, filter.from, filter.to);
  const sales = rows.reduce((s, r) => s + r.sales, 0);
  const cost = rows.reduce((s, r) => s + r.cost, 0);
  return {
    totals: { sales, cost, profit: sales - cost, transactions: rows.length },
    byStatus: {},
  };
}
