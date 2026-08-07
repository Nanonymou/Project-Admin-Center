import { NextResponse, type NextRequest } from "next/server";
import {
  aggregateByPeriod,
  type DashboardFilter,
  type PeriodGranularity,
} from "@/db/repositories/daily-transaction-repository";
import { authorizeDashboard, getPersonaFromHeaders } from "@/lib/server/rbac";
import { parsePeriod } from "@/lib/server/period";
import { canAccessLocation } from "@/lib/personas";
import { SITE_KPI } from "@/lib/mock/site-kpi";
import { buildProfitTrendForRange } from "@/lib/mock/margin-data";

export const dynamic = "force-dynamic";

/**
 * GET /api/chart?granularity=day|month&projectId=&from=&to=&scope=
 * Time-series sales/cost/profit for interactive site charts.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const projectId = sp.get("projectId") ?? undefined;
  const period = parsePeriod(sp);
  const granularity: PeriodGranularity = sp.get("granularity") === "month" ? "month" : "day";
  const filter: DashboardFilter = {
    projectId,
    locationId: sp.get("locationId") ?? undefined,
    from: period.from,
    to: period.to,
    scope: (sp.get("scope") as "tenant" | "executive" | null) ?? (projectId ? "tenant" : "executive"),
  };

  const persona = getPersonaFromHeaders(req.headers);
  const authz = authorizeDashboard(persona, filter);
  if (!authz.ok) {
    return NextResponse.json({ error: authz.message, role: persona.role }, { status: authz.status });
  }

  try {
    const series = await aggregateByPeriod(filter, granularity);
    return NextResponse.json({ source: "db", granularity, filter, series });
  } catch {
    let sites = SITE_KPI.filter((s) => canAccessLocation(persona, s.locationId, s.projectCode));
    if (filter.projectId) sites = sites.filter((s) => s.projectCode === filter.projectId);
    if (filter.locationId) sites = sites.filter((s) => s.locationId === filter.locationId);
    const from = filter.from ?? new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
    const to = filter.to ?? new Date().toISOString().slice(0, 10);
    const series = buildProfitTrendForRange(sites, from, to).map((p) => ({
      period: p.month,
      sales: p.sales,
      cost: p.cost,
      profit: p.profit,
    }));
    return NextResponse.json({ source: "mock", granularity, filter, series });
  }
}
