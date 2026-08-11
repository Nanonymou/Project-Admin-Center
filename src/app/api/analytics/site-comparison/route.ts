import { NextResponse, type NextRequest } from "next/server";
import { requirePersona } from "@/lib/server/rbac";
import { canAccessProject } from "@/lib/personas";
import { resolveScopedSites } from "@/lib/server/services/analytics-aggregation";

export const dynamic = "force-dynamic";

/**
 * GET /api/analytics/site-comparison?projectId=&sort=sla|margin
 *
 * Per-site comparison of SLA % and margin % across the persona's accessible
 * sites, ranked by the chosen metric (SLA by default). Powers the Analytics
 * Dashboard's Site Comparison. Persona-scoped, config-derived.
 */
export async function GET(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;

  const sp = req.nextUrl.searchParams;
  const projectId = sp.get("projectId") ?? undefined;
  const sort = sp.get("sort") === "margin" ? "margin" : "sla";

  if (projectId && !canAccessProject(persona, projectId)) {
    return NextResponse.json({ error: `Tidak ada akses ke project ${projectId}.` }, { status: 403 });
  }

  const rows = resolveScopedSites(persona, { projectId })
    .map((s) => ({
      locationId: s.locationId,
      locationName: s.locationName,
      projectCode: s.projectCode,
      slaPct: s.slaPct,
      marginPct: s.marginPct,
      sales: s.sales,
    }))
    .sort((a, b) => (sort === "margin" ? b.marginPct - a.marginPct : b.slaPct - a.slaPct));

  return NextResponse.json({ source: "config", sort, count: rows.length, rows });
}
