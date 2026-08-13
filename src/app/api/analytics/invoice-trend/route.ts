import { NextResponse, type NextRequest } from "next/server";
import { requirePersona } from "@/lib/server/rbac";
import { canAccessProject } from "@/lib/personas";
import { resolveScopedSites, buildInvoiceTrend } from "@/lib/server/services/analytics-aggregation";

export const dynamic = "force-dynamic";

/**
 * GET /api/analytics/invoice-trend?projectId=&locationId=
 *
 * The 6-month invoice trend (count + issued/paid value) for the Analytics
 * Dashboard's invoice trend chart, seeded from the persona's scoped portfolio
 * sales. Persona-scoped with optional project/location narrowing.
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
  const trend = buildInvoiceTrend(totalSales, sites.length);

  return NextResponse.json({
    source: "config",
    siteCount: sites.length,
    totalIssued: trend.reduce((s, p) => s + p.issued, 0),
    totalPaid: trend.reduce((s, p) => s + p.paid, 0),
    trend,
  });
}
