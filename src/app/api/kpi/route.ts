import { NextResponse, type NextRequest } from "next/server";
import { aggregateKpisBySite, type DashboardFilter } from "@/db/repositories/daily-transaction-repository";
import { authorizeDashboard, getPersonaFromHeaders } from "@/lib/server/rbac";
import { canAccessLocation } from "@/lib/personas";
import { SITE_KPI, scaleSiteKpisByPeriod } from "@/lib/mock/site-kpi";

export const dynamic = "force-dynamic";

/**
 * GET /api/kpi?projectId=&locationId=&from=&to=&scope=
 * Per-site KPI aggregation. Cross-site (executive) access is restricted to
 * Leader/Super Admin; other roles are limited to their own scope.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const projectId = sp.get("projectId") ?? undefined;
  const filter: DashboardFilter = {
    projectId,
    locationId: sp.get("locationId") ?? undefined,
    from: sp.get("from") ?? undefined,
    to: sp.get("to") ?? undefined,
    scope: (sp.get("scope") as "tenant" | "executive" | null) ?? (projectId ? "tenant" : "executive"),
  };

  const persona = getPersonaFromHeaders(req.headers);
  const authz = authorizeDashboard(persona, filter);
  if (!authz.ok) {
    return NextResponse.json({ error: authz.message, role: persona.role }, { status: authz.status });
  }

  try {
    const sites = await aggregateKpisBySite(filter);
    return NextResponse.json({ source: "db", filter, sites });
  } catch {
    // Mock fallback scoped to the persona's accessible sites.
    let rows = SITE_KPI.filter((s) => canAccessLocation(persona, s.locationId, s.projectCode));
    if (filter.projectId) rows = rows.filter((r) => r.projectCode === filter.projectId);
    if (filter.locationId) rows = rows.filter((r) => r.locationId === filter.locationId);
    if (filter.from && filter.to) rows = scaleSiteKpisByPeriod(rows, filter.from, filter.to);
    const sites = rows.map((r) => ({
      projectId: r.projectCode,
      locationId: r.locationId,
      locationName: r.locationName,
      sales: r.sales,
      cost: r.cost,
      profit: r.sales - r.cost,
      transactions: 0,
    }));
    return NextResponse.json({ source: "mock", filter, sites });
  }
}
