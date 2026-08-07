import { NextResponse, type NextRequest } from "next/server";
import { listApprovalTimelines, type ApprovalFilter } from "@/db/repositories/approval-repository";
import { authorizeDashboard, requirePersona } from "@/lib/server/rbac";
import { canAccessLocation } from "@/lib/personas";
import { SITE_KPI } from "@/lib/mock/site-kpi";
import { SITE_DETAILS } from "@/lib/mock/site-detail";
import { buildSiteApprovalTimelines } from "@/lib/mock/approval-timeline";

export const dynamic = "force-dynamic";

/**
 * GET /api/approvals/timeline?projectId=&locationId=&subjectType=&scope=
 * Detailed approval timeline per site — each subject with its ordered stage
 * history. A locationId narrows to a single site; without one, timelines are
 * grouped per site the persona may access. Cross-site (executive) access is
 * restricted to Leader/Super Admin. Falls back to mock timelines when the
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
    const timelines = (await listApprovalTimelines(filter)).filter((t) =>
      canAccessLocation(persona, t.approval.locationId, t.approval.projectId),
    );
    return NextResponse.json({ source: "db", filter, count: timelines.length, timelines });
  } catch {
    let sites = SITE_KPI.filter((s) => canAccessLocation(persona, s.locationId, s.projectCode));
    if (projectId) sites = sites.filter((s) => s.projectCode === projectId);
    if (locationId) sites = sites.filter((s) => s.locationId === locationId);

    const perSite = sites.map((s) => {
      const detail = SITE_DETAILS[s.locationId];
      return {
        projectId: s.projectCode,
        locationId: s.locationId,
        locationName: s.locationName,
        timelines: detail ? buildSiteApprovalTimelines(detail) : [],
      };
    });

    return NextResponse.json({ source: "mock", filter, count: perSite.length, perSite });
  }
}
