import { NextResponse, type NextRequest } from "next/server";
import {
  listStageProgress,
  type StageProgressFilter,
} from "@/db/repositories/invoice-stage-progress-repository";
import { buildTimeline } from "@/lib/server/services/invoice-timeline-service";
import { authorizeDashboard, requirePersona } from "@/lib/server/rbac";
import { canAccessLocation } from "@/lib/personas";
import { SITE_KPI } from "@/lib/mock/site-kpi";
import { SITE_DETAILS } from "@/lib/mock/site-detail";

export const dynamic = "force-dynamic";

/**
 * GET /api/invoices/timeline?projectId=&locationId=&breached=&scope=
 * Processing-timeline stage rows across a site or project (the aggregate view for
 * monitoring where invoices sit in the flow and which stages breached SLA).
 * Persona-scoped; cross-project (executive) scope is limited to Leader/Super
 * Admin by `authorizeDashboard`. Falls back to per-invoice timelines synthesized
 * from config when the DB is unavailable.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const projectId = sp.get("projectId") ?? undefined;
  const locationId = sp.get("locationId") ?? undefined;
  const breachedRaw = sp.get("breached");
  const breached = breachedRaw === null ? undefined : breachedRaw === "1" || breachedRaw === "true";
  const scope = (sp.get("scope") as "tenant" | "executive" | null) ?? (projectId ? "tenant" : "executive");
  const filter: StageProgressFilter = { projectId, locationId, breached, scope };

  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;
  const authz = authorizeDashboard(persona, { projectId, locationId, scope });
  if (!authz.ok) {
    return NextResponse.json({ error: authz.message, role: persona.role }, { status: authz.status });
  }

  try {
    const rows = (await listStageProgress(filter)).filter((r) =>
      canAccessLocation(persona, r.locationId, r.projectId),
    );
    return NextResponse.json({ source: "db", filter, count: rows.length, stages: rows });
  } catch {
    // Mock fallback: synthesize a timeline per accessible invoice from config.
    let sites = SITE_KPI.filter((s) => canAccessLocation(persona, s.locationId, s.projectCode));
    if (projectId) sites = sites.filter((s) => s.projectCode === projectId);
    if (locationId) sites = sites.filter((s) => s.locationId === locationId);
    const timelines = sites.flatMap((s) => {
      const detail = SITE_DETAILS[s.locationId];
      if (!detail) return [];
      return detail.invoices.map((inv) => ({
        invoiceId: `${s.locationId}-${inv.number}`,
        number: inv.number,
        projectCode: s.projectCode,
        locationId: s.locationId,
        stages: buildTimeline(s.projectCode, `${s.locationId}-${inv.number}`).filter(
          (st) => breached === undefined || st.breached === breached,
        ),
      }));
    });
    return NextResponse.json({ source: "mock", filter, count: timelines.length, timelines });
  }
}
