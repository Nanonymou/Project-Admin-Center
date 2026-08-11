import { NextResponse, type NextRequest } from "next/server";
import { requirePersona } from "@/lib/server/rbac";
import { canAccessProject } from "@/lib/personas";
import { resolveScopedSites, aggregateSalesCostTrend } from "@/lib/server/services/analytics-aggregation";

export const dynamic = "force-dynamic";

/**
 * GET /api/analytics/profit-trend?projectId=&locationId=
 *
 * The aggregated 7-day profit trend with per-day margin %, for the Analytics
 * Dashboard's profitability chart. Persona-scoped with optional project/location
 * narrowing. Config-derived from SITE_KPI.
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
    sales: p.sales,
    cost: p.cost,
    profit: p.profit,
    marginPct: p.sales > 0 ? (p.profit / p.sales) * 100 : 0,
  }));

  const totalProfit = trend.reduce((s, p) => s + p.profit, 0);
  const totalSales = trend.reduce((s, p) => s + p.sales, 0);
  const avgMarginPct = totalSales > 0 ? (totalProfit / totalSales) * 100 : 0;

  return NextResponse.json({ source: "config", siteCount: sites.length, totalProfit, avgMarginPct, trend });
}
