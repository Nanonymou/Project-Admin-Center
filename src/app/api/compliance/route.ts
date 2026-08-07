import { NextResponse, type NextRequest } from "next/server";
import {
  aggregateSubmissionStatusBySite,
  type DashboardFilter,
} from "@/db/repositories/daily-transaction-repository";
import { authorizeDashboard, requirePersona } from "@/lib/server/rbac";
import { parsePeriod } from "@/lib/server/period";
import { canAccessLocation } from "@/lib/personas";
import { SITE_KPI } from "@/lib/mock/site-kpi";
import { buildCutOffRows } from "@/lib/mock/cutoff-config";

export const dynamic = "force-dynamic";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

type SiteCompliance = {
  projectCode: string;
  locationId: string;
  locationName?: string;
  total: number;
  onTime: number;
  late: number;
  complianceRate: number;
};

function overallOf(sites: SiteCompliance[]) {
  const total = sites.reduce((s, r) => s + r.total, 0);
  const onTime = sites.reduce((s, r) => s + r.onTime, 0);
  return {
    total,
    onTime,
    late: total - onTime,
    complianceRate: total > 0 ? round2((onTime / total) * 100) : 0,
    sitesBelowTarget: sites.filter((s) => s.complianceRate < 90).length,
  };
}

/**
 * GET /api/compliance?projectId=&locationId=&period=&from=&to=&scope=
 * Daily data-submission compliance summary: per-site on-time vs late submission
 * rate and an overall roll-up, scoped to the persona. Cross-site (executive)
 * access is restricted to Leader/Super Admin. Falls back to mock cut-off data
 * when the database is unavailable.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const projectId = sp.get("projectId") ?? undefined;
  const period = parsePeriod(sp, undefined, projectId);
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

  try {
    const rows = (await aggregateSubmissionStatusBySite(filter, "cost")).filter((s) =>
      canAccessLocation(persona, s.locationId, s.projectId),
    );
    const sites: SiteCompliance[] = rows.map((s) => {
      const onTime = Math.max(0, s.total - s.late);
      return {
        projectCode: s.projectId,
        locationId: s.locationId,
        total: s.total,
        onTime,
        late: s.late,
        complianceRate: s.total > 0 ? round2((onTime / s.total) * 100) : 0,
      };
    });
    return NextResponse.json({ source: "db", filter, overall: overallOf(sites), sites });
  } catch {
    let scoped = SITE_KPI.filter((s) => canAccessLocation(persona, s.locationId, s.projectCode));
    if (projectId) scoped = scoped.filter((s) => s.projectCode === projectId);
    if (filter.locationId) scoped = scoped.filter((s) => s.locationId === filter.locationId);
    const sites: SiteCompliance[] = buildCutOffRows(scoped).map((c) => {
      const total = 30;
      const onTime = Math.round((c.submittedPct / 100) * total);
      return {
        projectCode: c.projectCode,
        locationId: c.locationId,
        locationName: c.locationName,
        total,
        onTime,
        late: total - onTime,
        complianceRate: round2((onTime / total) * 100),
      };
    });
    return NextResponse.json({ source: "mock", filter, overall: overallOf(sites), sites });
  }
}
