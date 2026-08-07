import { NextResponse, type NextRequest } from "next/server";
import {
  aggregateByCategory,
  aggregateByPeriod,
  aggregateSalesCostBySite,
  type DashboardFilter,
} from "@/db/repositories/daily-transaction-repository";
import { authorizeDashboard, getPersonaFromHeaders } from "@/lib/server/rbac";
import { parsePeriod } from "@/lib/server/period";
import { canAccessLocation } from "@/lib/personas";
import { SITE_KPI, scaleSiteKpisByPeriod } from "@/lib/mock/site-kpi";
import { SITE_DETAILS } from "@/lib/mock/site-detail";
import { buildProfitTrendForRange } from "@/lib/mock/margin-data";

export const dynamic = "force-dynamic";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * GET /api/daily-sales/summary?projectId=&locationId=&granularity=day|month&period=&from=&to=&scope=
 * Aggregate daily-sales totals for the dashboard: overall total, per-site,
 * per-category breakdown, and a trend series — scoped to the persona. Falls back
 * to mock aggregation when the database is unavailable.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const projectId = sp.get("projectId") ?? undefined;
  const period = parsePeriod(sp, undefined, projectId);
  const granularity = sp.get("granularity") === "day" ? "day" : "month";
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
    const bySiteRaw = (await aggregateSalesCostBySite(filter)).filter((s) =>
      canAccessLocation(persona, s.locationId, s.projectId),
    );
    const bySite = bySiteRaw.map((s) => ({
      projectCode: s.projectId,
      locationId: s.locationId,
      sales: round2(s.sales),
    }));
    const totalSales = round2(bySiteRaw.reduce((sum, s) => sum + s.sales, 0));
    const byCategory = await aggregateByCategory(filter, "sales");
    const trend = (await aggregateByPeriod(filter, granularity)).map((p) => ({
      period: p.period,
      sales: round2(p.sales),
    }));
    return NextResponse.json({ source: "db", filter, totalSales, bySite, byCategory, trend });
  } catch {
    let rows = SITE_KPI.filter((s) => canAccessLocation(persona, s.locationId, s.projectCode));
    if (projectId) rows = rows.filter((r) => r.projectCode === projectId);
    if (filter.locationId) rows = rows.filter((r) => r.locationId === filter.locationId);
    if (filter.from && filter.to) rows = scaleSiteKpisByPeriod(rows, filter.from, filter.to);

    const bySite = rows.map((r) => ({ projectCode: r.projectCode, locationId: r.locationId, sales: r.sales }));
    const totalSales = rows.reduce((sum, r) => sum + r.sales, 0);

    // Category breakdown folded across the scoped sites' mock category points.
    const catMap = new Map<string, number>();
    for (const r of rows) {
      const detail = SITE_DETAILS[r.locationId];
      if (!detail) continue;
      for (const c of detail.categories) catMap.set(c.category, (catMap.get(c.category) ?? 0) + c.amount);
    }
    const byCategory = Array.from(catMap.entries())
      .map(([label, amount]) => ({ categoryKey: label, label, amount }))
      .sort((a, b) => b.amount - a.amount);

    const from = filter.from ?? new Date(Date.now() - 180 * 86_400_000).toISOString().slice(0, 10);
    const to = filter.to ?? new Date().toISOString().slice(0, 10);
    const trend = buildProfitTrendForRange(rows, from, to).map((p) => ({ period: p.month, sales: p.sales }));

    return NextResponse.json({ source: "mock", filter, totalSales, bySite, byCategory, trend });
  }
}
