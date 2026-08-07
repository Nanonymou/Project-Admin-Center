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

/**
 * GET /api/daily-cost/status?projectId=&locationId=&period=&from=&to=&scope=
 * Per-site daily-cost submission status across the sites the persona may see:
 * counts of draft/submitted/approved/locked plus late submissions. Cross-site
 * (executive) access is restricted to Leader/Super Admin. Falls back to mock
 * cut-off status when the database is unavailable.
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
    const sites = (await aggregateSubmissionStatusBySite(filter, "cost")).filter((s) =>
      canAccessLocation(persona, s.locationId, s.projectId),
    );
    return NextResponse.json({ source: "db", filter, sites });
  } catch {
    let rows = SITE_KPI.filter((s) => canAccessLocation(persona, s.locationId, s.projectCode));
    if (projectId) rows = rows.filter((r) => r.projectCode === projectId);
    if (filter.locationId) rows = rows.filter((r) => r.locationId === filter.locationId);

    const sites = buildCutOffRows(rows).map((r) => ({
      projectId: r.projectCode,
      locationId: r.locationId,
      locationName: r.locationName,
      submittedPct: r.submittedPct,
      status: r.status,
      delivery: r.delivery,
      cutOffDate: r.cutOffDate,
      daysLeft: r.daysLeft,
    }));
    return NextResponse.json({ source: "mock", filter, sites });
  }
}
