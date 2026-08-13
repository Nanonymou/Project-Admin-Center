import { NextResponse, type NextRequest } from "next/server";
import { requirePersona } from "@/lib/server/rbac";
import { canAccessProject } from "@/lib/personas";
import { resolveScopedSites } from "@/lib/server/services/analytics-aggregation";

export const dynamic = "force-dynamic";

/**
 * GET /api/analytics/monthly-comparison?projectId=&locationId=
 *
 * Current vs previous period comparison (sales, margin %, SLA %) aggregated from
 * each scoped site's prevPeriod snapshot, with deltas. Powers the Analytics
 * Dashboard's Monthly Comparison. Persona-scoped, config-derived.
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

  const withPrev = resolveScopedSites(persona, { projectId, locationId }).filter((s) => s.prevPeriod);

  const avg = (fn: (s: (typeof withPrev)[number]) => number) =>
    withPrev.length ? withPrev.reduce((sum, s) => sum + fn(s), 0) / withPrev.length : 0;

  const curSales = withPrev.reduce((sum, s) => sum + s.sales, 0);
  const prevSales = withPrev.reduce((sum, s) => sum + (s.prevPeriod?.sales ?? 0), 0);
  const curMargin = avg((s) => s.marginPct);
  const prevMargin = avg((s) => s.prevPeriod?.marginPct ?? 0);
  const curSla = avg((s) => s.slaPct);
  const prevSla = avg((s) => s.prevPeriod?.slaPct ?? 0);

  return NextResponse.json({
    source: "config",
    siteCount: withPrev.length,
    metrics: [
      {
        key: "sales",
        label: "Sales",
        current: curSales,
        previous: prevSales,
        deltaPct: prevSales > 0 ? ((curSales - prevSales) / prevSales) * 100 : 0,
      },
      { key: "marginPct", label: "Margin %", current: curMargin, previous: prevMargin, deltaPp: curMargin - prevMargin },
      { key: "slaPct", label: "SLA %", current: curSla, previous: prevSla, deltaPp: curSla - prevSla },
    ],
  });
}
