import { NextResponse, type NextRequest } from "next/server";
import type { ApprovalFilter } from "@/db/repositories/approval-repository";
import { authorizeDashboard, requirePersona } from "@/lib/server/rbac";
import { canAccessLocation } from "@/lib/personas";
import {
  computeSlaBySite,
  foldSlaSummary,
  type SiteSlaRow,
} from "@/lib/server/services/sla-monitoring-service";
import { buildApprovalReminderSummaries } from "@/lib/server/services/approval-reminder-service";
import { SITE_KPI } from "@/lib/mock/site-kpi";
import { SITE_DETAILS } from "@/lib/mock/site-detail";

export const dynamic = "force-dynamic";

/**
 * GET /api/sla/by-site?projectId=&locationId=&subjectType=&scope=
 *
 * Per-site SLA approval monitoring: for each site, how many in-flight approvals
 * are on-time, at-risk, or breached against the resolved SLA target, plus a
 * compliance percentage. Scoped to the persona; cross-site (executive) access is
 * restricted to Leader/Super Admin. Falls back to mock reminder-derived SLA
 * data when the database is unavailable.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const projectId = sp.get("projectId") ?? undefined;
  const locationId = sp.get("locationId") ?? undefined;
  const subjectTypeRaw = sp.get("subjectType");
  const subjectType =
    subjectTypeRaw === "invoice" || subjectTypeRaw === "daily_closing" ? subjectTypeRaw : undefined;
  const scope = (sp.get("scope") as "tenant" | "executive" | null) ?? (projectId ? "tenant" : "executive");
  const filter: ApprovalFilter = { projectId, locationId, subjectType, scope };

  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;
  const authz = authorizeDashboard(persona, filter);
  if (!authz.ok) {
    return NextResponse.json({ error: authz.message, role: persona.role }, { status: authz.status });
  }

  try {
    const sites = (await computeSlaBySite(filter)).filter((r) =>
      canAccessLocation(persona, r.locationId, r.projectId),
    );
    return NextResponse.json({
      source: "db",
      filter,
      summary: foldSlaSummary(sites),
      count: sites.length,
      sites,
    });
  } catch {
    let mockSites = SITE_KPI.filter((s) => canAccessLocation(persona, s.locationId, s.projectCode));
    if (projectId) mockSites = mockSites.filter((s) => s.projectCode === projectId);
    if (locationId) mockSites = mockSites.filter((s) => s.locationId === locationId);
    const summaries = buildApprovalReminderSummaries(mockSites, SITE_DETAILS);
    const sites: SiteSlaRow[] = summaries.map((s) => {
      const onTime = Math.max(0, s.pending - s.atRisk - s.overdue);
      const compliancePct = s.pending > 0 ? Math.round((onTime / s.pending) * 10000) / 100 : 100;
      return {
        projectId: s.projectId,
        locationId: s.locationId,
        total: s.pending,
        completed: 0,
        inProgress: s.pending,
        onTime,
        atRisk: s.atRisk,
        breached: s.overdue,
        compliancePct,
        status: s.overdue > 0 ? "breached" : s.atRisk > 0 ? "at_risk" : s.pending > 0 ? "on_time" : "clear",
      };
    });
    return NextResponse.json({
      source: "mock",
      filter,
      summary: foldSlaSummary(sites),
      count: sites.length,
      sites,
    });
  }
}
