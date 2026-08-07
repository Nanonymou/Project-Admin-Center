import { NextResponse, type NextRequest } from "next/server";
import { foldApprovalProgress, type ApprovalFilter } from "@/db/repositories/approval-repository";
import { cachedApprovalProgressBySite, cachedApprovalStageFunnel } from "@/lib/server/approval-cache";
import { authorizeDashboard, requirePersona } from "@/lib/server/rbac";
import { canAccessLocation } from "@/lib/personas";
import { SITE_KPI } from "@/lib/mock/site-kpi";
import { SITE_DETAILS } from "@/lib/mock/site-detail";
import { buildApprovalRemindersFor } from "@/lib/mock/approvals";
import { buildStageProgress, summarizeApprovalProgress } from "@/lib/mock/approval-progress";
import { buildApprovalReminderSummaries } from "@/lib/server/services/approval-reminder-service";

export const dynamic = "force-dynamic";

/**
 * GET /api/approvals/progress?projectId=&locationId=&subjectType=&scope=
 * Approval-progress summary across the sites the persona may see: an overall
 * roll-up, per-site progress, and the stage funnel. Cross-site (executive)
 * access is restricted to Leader/Super Admin. Falls back to mock aggregation
 * when the database is unavailable.
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
    const perSite = (await cachedApprovalProgressBySite(filter)).filter((s) =>
      canAccessLocation(persona, s.locationId, s.projectId),
    );
    const funnel = await cachedApprovalStageFunnel(filter);
    return NextResponse.json({
      source: "db",
      filter,
      summary: foldApprovalProgress(perSite),
      perSite,
      funnel,
    });
  } catch {
    let sites = SITE_KPI.filter((s) => canAccessLocation(persona, s.locationId, s.projectCode));
    if (projectId) sites = sites.filter((s) => s.projectCode === projectId);
    if (locationId) sites = sites.filter((s) => s.locationId === locationId);

    const reminders = buildApprovalRemindersFor(sites, SITE_DETAILS);
    // Settled = invoices already at the Payment stage across the scoped sites.
    const settledCount = sites.reduce((n, s) => {
      const detail = SITE_DETAILS[s.locationId];
      return n + (detail ? detail.invoices.filter((i) => i.stage === "Payment").length : 0);
    }, 0);

    return NextResponse.json({
      source: "mock",
      filter,
      summary: summarizeApprovalProgress(reminders, settledCount),
      perSite: buildApprovalReminderSummaries(sites, SITE_DETAILS),
      funnel: buildStageProgress(reminders),
    });
  }
}
