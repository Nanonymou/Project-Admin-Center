import { NextResponse, type NextRequest } from "next/server";
import { aggregateSalesByArea, type DashboardFilter } from "@/db/repositories/daily-transaction-repository";
import { authorizeDashboard, getPersonaFromHeaders } from "@/lib/server/rbac";
import { parsePeriod } from "@/lib/server/period";
import { canAccessLocation } from "@/lib/personas";
import { SITE_KPI, scaleSiteKpisByPeriod } from "@/lib/mock/site-kpi";
import { getAreasFor } from "@/lib/mock/area-config";

export const dynamic = "force-dynamic";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * GET /api/daily-sales/by-area?projectId=&locationId=&period=&from=&to=&scope=
 * Total sales aggregated per sales area across the sites the persona may see.
 * Cross-site (executive) access is restricted to Leader/Super Admin. Falls back
 * to a mock per-area distribution when the database is unavailable.
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
    const areas = await aggregateSalesByArea(filter, "sales");
    const totalSales = round2(areas.reduce((s, a) => s + a.sales, 0));
    return NextResponse.json({ source: "db", filter, totalSales, areas });
  } catch {
    let rows = SITE_KPI.filter((s) => canAccessLocation(persona, s.locationId, s.projectCode));
    if (projectId) rows = rows.filter((r) => r.projectCode === projectId);
    if (filter.locationId) rows = rows.filter((r) => r.locationId === filter.locationId);
    if (filter.from && filter.to) rows = scaleSiteKpisByPeriod(rows, filter.from, filter.to);

    // Distribute each site's sales across its configured areas deterministically.
    const map = new Map<string, { sales: number; transactions: number }>();
    for (const r of rows) {
      const areas = getAreasFor(r.locationId, r.locationName);
      if (!areas.length) continue;
      const per = r.sales / areas.length;
      for (const a of areas) {
        const entry = map.get(a.name) ?? { sales: 0, transactions: 0 };
        entry.sales += per;
        entry.transactions += 1;
        map.set(a.name, entry);
      }
    }
    const areas = Array.from(map.entries())
      .map(([area, v]) => ({ area, sales: round2(v.sales), transactions: v.transactions }))
      .sort((a, b) => b.sales - a.sales);
    const totalSales = round2(areas.reduce((s, a) => s + a.sales, 0));
    return NextResponse.json({ source: "mock", filter, totalSales, areas });
  }
}
