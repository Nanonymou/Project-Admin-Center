import { NextResponse, type NextRequest } from "next/server";
import { requirePersona } from "@/lib/server/rbac";
import { canAccessProject } from "@/lib/personas";
import { resolveScopedSites, aggregateSalesCostTrend } from "@/lib/server/services/analytics-aggregation";

export const dynamic = "force-dynamic";

/**
 * GET /api/analytics/cost-trend?projectId=&locationId=
 *
 * The aggregated 7-day cost trend with per-day cost-to-sales ratio and an average
 * ratio, for the Analytics Dashboard's cost trend chart. Persona-scoped with
 * optional project/location narrowing. Config-derived from SITE_KPI.
 */
export async function GET(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;

  const sp = req.nextUrl.searchParams;
  const projectId = sp.get("projectId") ?? undefined;
  const locationId = sp.get("locationId") ?? undefined;

  if (projectId && !canAccessProject(persona, projectId)) {
    return NextResponse.json({ error: `Tidak ada akses ke project ${projectId}.` }, { status: 403 });
  }

  const sites = resolveScopedSites(persona, { projectId, locationId });
  const trend = aggregateSalesCostTrend(sites).map((p) => ({
    date: p.date,
    day: p.day,
    cost: p.cost,
    ratioPct: p.sales > 0 ? (p.cost / p.sales) * 100 : 0,
  }));

  const totalSales = aggregateSalesCostTrend(sites).reduce((s, p) => s + p.sales, 0);
  const totalCost = trend.reduce((s, p) => s + p.cost, 0);
  const avgRatioPct = totalSales > 0 ? (totalCost / totalSales) * 100 : 0;

  return NextResponse.json({ source: "config", siteCount: sites.length, totalCost, avgRatioPct, trend });
}
