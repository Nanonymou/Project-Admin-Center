import { NextResponse, type NextRequest } from "next/server";
import { listApprovalRollup, type ApprovalFilter } from "@/db/repositories/approval-repository";
import { authorizeDashboard, requirePersona } from "@/lib/server/rbac";
import { canAccessLocation } from "@/lib/personas";
import { SITE_KPI } from "@/lib/mock/site-kpi";
import { SITE_DETAILS } from "@/lib/mock/site-detail";
import { buildApprovalReminderSummaries } from "@/lib/server/services/approval-reminder-service";

export const dynamic = "force-dynamic";

/**
 * GET /api/approvals/by-site?projectId=&locationId=&subjectType=&scope=
 * Per-location approval dashboard summary: rollup counts by stage/status per
 * site, scoped to the persona. Cross-site (executive) access is restricted to
 * Leader/Super Admin. Falls back to mock per-site approval summaries when the
 * database is unavailable.
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
    const rows = (await listApprovalRollup(filter)).filter((r) =>
      canAccessLocation(persona, r.locationId, r.projectId),
    );
    return NextResponse.json({ source: "db", filter, count: rows.length, rows });
  } catch {
    let sites = SITE_KPI.filter((s) => canAccessLocation(persona, s.locationId, s.projectCode));
    if (projectId) sites = sites.filter((s) => s.projectCode === projectId);
    if (locationId) sites = sites.filter((s) => s.locationId === locationId);
    const perSite = buildApprovalReminderSummaries(sites, SITE_DETAILS);
    return NextResponse.json({ source: "mock", filter, count: perSite.length, perSite });
  }
}
