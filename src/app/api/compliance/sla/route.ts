import { NextResponse, type NextRequest } from "next/server";
import { listApprovalOverdueBySite, type ApprovalFilter } from "@/db/repositories/approval-repository";
import { authorizeDashboard, requirePersona } from "@/lib/server/rbac";
import { canAccessLocation } from "@/lib/personas";
import { SITE_KPI } from "@/lib/mock/site-kpi";
import { SITE_DETAILS } from "@/lib/mock/site-detail";
import { buildApprovalReminderSummaries } from "@/lib/server/services/approval-reminder-service";

export const dynamic = "force-dynamic";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

type SlaIndicator = {
  projectCode: string;
  locationId: string;
  locationName?: string;
  inProgress: number;
  overdue: number;
  slaComplianceRate: number;
  avgTimeInStage?: number;
  worstBreachDays?: number;
};

function overallOf(sites: SlaIndicator[]) {
  const inProgress = sites.reduce((s, r) => s + r.inProgress, 0);
  const overdue = sites.reduce((s, r) => s + r.overdue, 0);
  return {
    inProgress,
    overdue,
    slaComplianceRate: inProgress > 0 ? round2(((inProgress - overdue) / inProgress) * 100) : 100,
    sitesBreaching: sites.filter((s) => s.overdue > 0).length,
  };
}

/**
 * GET /api/compliance/sla?projectId=&locationId=&scope=
 * Approval SLA indicators per site: in-progress vs overdue approvals and the
 * resulting SLA compliance rate, scoped to the persona. Cross-site (executive)
 * access is restricted to Leader/Super Admin. Falls back to mock approval
 * summaries (with avg time-in-stage and worst breach) when the DB is unavailable.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const projectId = sp.get("projectId") ?? undefined;
  const locationId = sp.get("locationId") ?? undefined;
  const scope = (sp.get("scope") as "tenant" | "executive" | null) ?? (projectId ? "tenant" : "executive");
  const filter: ApprovalFilter = { projectId, locationId, scope };

  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;
  const authz = authorizeDashboard(persona, filter);
  if (!authz.ok) {
    return NextResponse.json({ error: authz.message, role: persona.role }, { status: authz.status });
  }

  try {
    const rows = (await listApprovalOverdueBySite(filter)).filter((r) =>
      canAccessLocation(persona, r.locationId, r.projectId),
    );
    const sites: SlaIndicator[] = rows.map((r) => ({
      projectCode: r.projectId,
      locationId: r.locationId,
      inProgress: r.inProgress,
      overdue: r.overdue,
      slaComplianceRate: r.inProgress > 0 ? round2(((r.inProgress - r.overdue) / r.inProgress) * 100) : 100,
    }));
    return NextResponse.json({ source: "db", filter, overall: overallOf(sites), sites });
  } catch {
    let scoped = SITE_KPI.filter((s) => canAccessLocation(persona, s.locationId, s.projectCode));
    if (projectId) scoped = scoped.filter((s) => s.projectCode === projectId);
    if (locationId) scoped = scoped.filter((s) => s.locationId === locationId);
    const sites: SlaIndicator[] = buildApprovalReminderSummaries(scoped, SITE_DETAILS).map((a) => ({
      projectCode: a.projectId,
      locationId: a.locationId,
      locationName: a.locationName,
      inProgress: a.pending,
      overdue: a.overdue,
      slaComplianceRate: a.pending > 0 ? round2(((a.pending - a.overdue) / a.pending) * 100) : 100,
      avgTimeInStage: round2(a.avgTimeInStage),
      worstBreachDays: a.worstBreachDays,
    }));
    return NextResponse.json({ source: "mock", filter, overall: overallOf(sites), sites });
  }
}
