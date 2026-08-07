import { NextResponse, type NextRequest } from "next/server";
import {
  aggregateSubmissionStatusBySite,
  type DashboardFilter,
  type SiteKpiAggregate,
  type SiteSubmissionStatus,
} from "@/db/repositories/daily-transaction-repository";
import { cachedSalesCostBySite } from "@/lib/server/kpi-cache";
import { buildProjectPerformance } from "@/lib/server/services/project-performance-service";
import { authorizeDashboard, requirePersona } from "@/lib/server/rbac";
import { parsePeriod } from "@/lib/server/period";
import { canAccessLocation } from "@/lib/personas";
import { SITE_KPI, scaleSiteKpisByPeriod } from "@/lib/mock/site-kpi";
import { buildCutOffRows } from "@/lib/mock/cutoff-config";

export const dynamic = "force-dynamic";

type SortKey = "profit" | "marginPct" | "complianceRate" | "sales";

/**
 * GET /api/project-performance?projectId=&period=&from=&to=&sort=&scope=
 * Ranked project performance: per-project margin and submission compliance,
 * scoped to the persona. Cross-project (executive) access is restricted to
 * Leader/Super Admin. Falls back to mock data when the DB is unavailable.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const projectId = sp.get("projectId") ?? undefined;
  const period = parsePeriod(sp, undefined, projectId);
  const sortRaw = sp.get("sort");
  const sort: SortKey = (["profit", "marginPct", "complianceRate", "sales"] as const).includes(
    sortRaw as SortKey,
  )
    ? (sortRaw as SortKey)
    : "profit";
  const scope = (sp.get("scope") as "tenant" | "executive" | null) ?? (projectId ? "tenant" : "executive");
  const filter: DashboardFilter = {
    projectId,
    locationId: sp.get("locationId") ?? undefined,
    from: period.from,
    to: period.to,
    scope,
  };

  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;
  const authz = authorizeDashboard(persona, filter);
  if (!authz.ok) {
    return NextResponse.json({ error: authz.message, role: persona.role }, { status: authz.status });
  }

  const sorter = (a: { [k in SortKey]: number }, b: { [k in SortKey]: number }) => b[sort] - a[sort];

  try {
    const kpis: SiteKpiAggregate[] = (await cachedSalesCostBySite(filter)).filter((s) =>
      canAccessLocation(persona, s.locationId, s.projectId),
    );
    const submissions: SiteSubmissionStatus[] = (
      await aggregateSubmissionStatusBySite(filter, "cost")
    ).filter((s) => canAccessLocation(persona, s.locationId, s.projectId));
    const ranking = buildProjectPerformance(kpis, submissions).sort(sorter);
    return NextResponse.json({ source: "db", filter, sort, ranking });
  } catch {
    let rows = SITE_KPI.filter((s) => canAccessLocation(persona, s.locationId, s.projectCode));
    if (projectId) rows = rows.filter((r) => r.projectCode === projectId);
    if (filter.locationId) rows = rows.filter((r) => r.locationId === filter.locationId);
    if (filter.from && filter.to) rows = scaleSiteKpisByPeriod(rows, filter.from, filter.to);

    const kpis: SiteKpiAggregate[] = rows.map((r) => ({
      projectId: r.projectCode,
      locationId: r.locationId,
      sales: r.sales,
      cost: r.cost,
      profit: r.sales - r.cost,
      transactions: 0,
    }));
    // Derive mock submission compliance from the cut-off submitted percentage.
    const submissions: SiteSubmissionStatus[] = buildCutOffRows(rows).map((c) => {
      const total = 30;
      const late = Math.round(((100 - c.submittedPct) / 100) * total);
      return {
        projectId: c.projectCode,
        locationId: c.locationId,
        total,
        draft: 0,
        submitted: total - late,
        approved: 0,
        locked: 0,
        late,
      };
    });
    const ranking = buildProjectPerformance(kpis, submissions).sort(sorter);
    return NextResponse.json({ source: "mock", filter, sort, ranking });
  }
}
