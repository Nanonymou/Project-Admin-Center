import { NextResponse, type NextRequest } from "next/server";
import { authorizeDashboard, requirePersona } from "@/lib/server/rbac";
import { canAccessLocation } from "@/lib/personas";
import { SITE_KPI } from "@/lib/mock/site-kpi";
import { SITE_DETAILS } from "@/lib/mock/site-detail";
import { buildDeadlineReminders, summarizeReminders } from "@/lib/server/services/reminder-service";
import { buildApprovalReminderSummaries } from "@/lib/server/services/approval-reminder-service";
import { buildOverdueInvoiceSummaries } from "@/lib/server/services/overdue-invoice-service";
import { buildRecentActivityPerSite } from "@/lib/server/services/recent-activity-service";

export const dynamic = "force-dynamic";

/**
 * GET /api/reminders?projectId=&locationId=&scope=
 * Aggregates the reminder widget data per site: cut-off deadlines, approval
 * reminders, overdue invoices, and recent activity — scoped to the persona.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const projectId = sp.get("projectId") ?? undefined;
  const locationId = sp.get("locationId") ?? undefined;
  const filter = {
    projectId,
    locationId,
    scope: (sp.get("scope") as "tenant" | "executive" | null) ?? (projectId ? "tenant" : "executive"),
  };

  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;
  const authz = authorizeDashboard(persona, filter);
  if (!authz.ok) {
    return NextResponse.json({ error: authz.message, role: persona.role }, { status: authz.status });
  }

  let sites = SITE_KPI.filter((s) => canAccessLocation(persona, s.locationId, s.projectCode));
  if (projectId) sites = sites.filter((s) => s.projectCode === projectId);
  if (locationId) sites = sites.filter((s) => s.locationId === locationId);

  const deadlines = buildDeadlineReminders(sites);
  const approvals = buildApprovalReminderSummaries(sites, SITE_DETAILS);
  const overdue = buildOverdueInvoiceSummaries(sites, SITE_DETAILS);
  const activity = buildRecentActivityPerSite(sites, 4);

  return NextResponse.json({
    source: "service",
    filter,
    siteCount: sites.length,
    deadlines,
    approvals,
    overdue,
    activity,
    summary: {
      deadlines: summarizeReminders(deadlines),
      overdueSites: overdue.filter((o) => o.overdueCount > 0).length,
      approvalOverdue: approvals.reduce((s, a) => s + a.overdue, 0),
    },
  });
}
