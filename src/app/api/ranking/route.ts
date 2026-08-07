import { NextResponse, type NextRequest } from "next/server";
import { aggregateKpisBySite, type DashboardFilter } from "@/db/repositories/daily-transaction-repository";
import { rankList, isRankMetric, type RankMetric } from "@/lib/server/services/ranking-service";
import { authorizeRanking, requirePersona } from "@/lib/server/rbac";
import { canAccessLocation } from "@/lib/personas";
import { SITE_KPI, scaleSiteKpisByPeriod } from "@/lib/mock/site-kpi";

export const dynamic = "force-dynamic";

/**
 * GET /api/ranking?metric=sales|profit|marginPct&projectId=&from=&to=&scope=
 * Ranks sites by the chosen metric, scoped to the caller's persona.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const projectId = sp.get("projectId") ?? undefined;
  const metric: RankMetric = isRankMetric(sp.get("metric")) ? (sp.get("metric") as RankMetric) : "sales";
  const filter: DashboardFilter = {
    projectId,
    locationId: sp.get("locationId") ?? undefined,
    from: sp.get("from") ?? undefined,
    to: sp.get("to") ?? undefined,
    scope: (sp.get("scope") as "tenant" | "executive" | null) ?? (projectId ? "tenant" : "executive"),
  };

  const auth = requirePersona(req.headers);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }
  const persona = auth.persona;
  const authz = authorizeRanking(persona, filter);
  if (!authz.ok) {
    return NextResponse.json({ error: authz.message, role: persona.role }, { status: authz.status });
  }

  try {
    const aggregates = (await aggregateKpisBySite(filter)).filter((s) =>
      canAccessLocation(persona, s.locationId, s.projectId),
    );
    return NextResponse.json({ source: "db", metric, filter, ranking: rankList(aggregates, metric) });
  } catch {
    let rows = SITE_KPI.filter((s) => canAccessLocation(persona, s.locationId, s.projectCode));
    if (filter.projectId) rows = rows.filter((r) => r.projectCode === filter.projectId);
    if (filter.locationId) rows = rows.filter((r) => r.locationId === filter.locationId);
    if (filter.from && filter.to) rows = scaleSiteKpisByPeriod(rows, filter.from, filter.to);
    const aggregates = rows.map((r) => ({
      projectId: r.projectCode,
      locationId: r.locationId,
      locationName: r.locationName,
      sales: r.sales,
      cost: r.cost,
      profit: r.sales - r.cost,
      transactions: 0,
    }));
    return NextResponse.json({ source: "mock", metric, filter, ranking: rankList(aggregates, metric) });
  }
}
