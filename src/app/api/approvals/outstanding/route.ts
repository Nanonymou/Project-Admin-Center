import { NextResponse, type NextRequest } from "next/server";
import { authorizeDashboard, requirePersona } from "@/lib/server/rbac";
import { canAccessLocation } from "@/lib/personas";
import { SITE_KPI } from "@/lib/mock/site-kpi";
import { SITE_DETAILS } from "@/lib/mock/site-detail";
import { buildOutstandingInvoicesFor, summarizeOutstanding } from "@/lib/mock/outstanding";
import { buildOverdueInvoiceSummaries } from "@/lib/server/services/overdue-invoice-service";
import { buildApprovalReminderSummaries } from "@/lib/server/services/approval-reminder-service";

export const dynamic = "force-dynamic";

/**
 * GET /api/approvals/outstanding?projectId=&locationId=&scope=
 * Outstanding & overdue activity for the approval dashboard: per-site overdue
 * invoices, overdue approvals, and outstanding totals — scoped to the persona.
 * Cross-site (executive) access is restricted to Leader/Super Admin.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const projectId = sp.get("projectId") ?? undefined;
  const locationId = sp.get("locationId") ?? undefined;
  const scope = (sp.get("scope") as "tenant" | "executive" | null) ?? (projectId ? "tenant" : "executive");
  const filter = { projectId, locationId, scope };

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

  const overdueInvoices = buildOverdueInvoiceSummaries(sites, SITE_DETAILS);
  const approvals = buildApprovalReminderSummaries(sites, SITE_DETAILS);
  const outstanding = summarizeOutstanding(buildOutstandingInvoicesFor(sites, SITE_DETAILS));

  // Merge the two per-site views keyed by location.
  const approvalByLoc = new Map(approvals.map((a) => [a.locationId, a]));
  const perSite = overdueInvoices.map((inv) => {
    const appr = approvalByLoc.get(inv.locationId);
    return {
      projectCode: inv.projectId,
      locationId: inv.locationId,
      locationName: inv.locationName,
      overdueInvoiceCount: inv.overdueCount,
      overdueInvoiceAmount: inv.overdueAmount,
      worstBucket: inv.worstBucket,
      overdueApprovals: appr?.overdue ?? 0,
      atRiskApprovals: appr?.atRisk ?? 0,
      pendingApprovals: appr?.pending ?? 0,
    };
  });

  return NextResponse.json({
    source: "service",
    filter,
    siteCount: sites.length,
    summary: {
      outstandingCount: outstanding.totalCount,
      outstandingAmount: outstanding.totalAmount,
      overdueInvoiceSites: overdueInvoices.filter((o) => o.overdueCount > 0).length,
      overdueApprovals: approvals.reduce((s, a) => s + a.overdue, 0),
    },
    perSite,
  });
}
