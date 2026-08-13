import { NextResponse, type NextRequest } from "next/server";
import { requirePersona } from "@/lib/server/rbac";
import { canAccessProject } from "@/lib/personas";
import { resolveScopedSites, buildRevenueGrowth } from "@/lib/server/services/analytics-aggregation";

export const dynamic = "force-dynamic";

/**
 * GET /api/analytics/revenue-growth?projectId=&locationId=
 *
 * The 6-month revenue series with month-over-month growth %, for the Analytics
 * Dashboard's Revenue Growth chart, seeded from the persona's scoped portfolio
 * sales (last month = current). Persona-scoped, config-derived.
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
  const totalSales = sites.reduce((s, x) => s + x.sales, 0);
  const trend = buildRevenueGrowth(totalSales);

  // Overall growth = latest vs earliest month.
  const overallGrowthPct =
    trend.length >= 2 && trend[0].revenue > 0
      ? ((trend[trend.length - 1].revenue - trend[0].revenue) / trend[0].revenue) * 100
      : 0;

  return NextResponse.json({ source: "config", siteCount: sites.length, overallGrowthPct, trend });
}
