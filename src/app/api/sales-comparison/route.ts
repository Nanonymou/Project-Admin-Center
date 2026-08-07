import { NextResponse, type NextRequest } from "next/server";
import { type DashboardFilter, type SiteKpiAggregate } from "@/db/repositories/daily-transaction-repository";
import { cachedSalesCostBySite } from "@/lib/server/kpi-cache";
import { buildSalesComparison } from "@/lib/server/services/sales-comparison-service";
import { authorizeDashboard, getPersonaFromHeaders } from "@/lib/server/rbac";
import { parsePeriod } from "@/lib/server/period";
import { canAccessLocation } from "@/lib/personas";
import { SITE_KPI, scaleSiteKpisByPeriod } from "@/lib/mock/site-kpi";

export const dynamic = "force-dynamic";

/**
 * GET /api/sales-comparison?projectId=&locationId=&period=&from=&to=&scope=
 * Sales comparison across sites for the comparison chart: per-site sales with
 * share, delta-vs-average, and rank, plus group totals — scoped to the persona.
 * Falls back to mock data when the database is unavailable.
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
    const sites = (await cachedSalesCostBySite(filter)).filter((s) =>
      canAccessLocation(persona, s.locationId, s.projectId),
    );
    return NextResponse.json({ source: "db", filter, ...buildSalesComparison(sites) });
  } catch {
    let rows = SITE_KPI.filter((s) => canAccessLocation(persona, s.locationId, s.projectCode));
    if (projectId) rows = rows.filter((r) => r.projectCode === projectId);
    if (filter.locationId) rows = rows.filter((r) => r.locationId === filter.locationId);
    if (filter.from && filter.to) rows = scaleSiteKpisByPeriod(rows, filter.from, filter.to);

    const sites: (SiteKpiAggregate & { locationName?: string })[] = rows.map((r) => ({
      projectId: r.projectCode,
      locationId: r.locationId,
      locationName: r.locationName,
      sales: r.sales,
      cost: r.cost,
      profit: r.sales - r.cost,
      transactions: 0,
    }));
    return NextResponse.json({ source: "mock", filter, ...buildSalesComparison(sites) });
  }
}
