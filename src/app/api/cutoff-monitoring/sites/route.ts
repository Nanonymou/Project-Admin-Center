import { NextResponse, type NextRequest } from "next/server";
import { listCutoffMonitoring, type CutoffFilter } from "@/db/repositories/cutoff-monitoring-repository";
import { authorizeDashboard, requirePersona } from "@/lib/server/rbac";
import { canAccessLocation } from "@/lib/personas";
import { SITE_KPI } from "@/lib/mock/site-kpi";
import {
  buildCutOffRows,
  CUTOFF_STATUS_META,
  DELIVERY_STATUS_META,
} from "@/lib/mock/cutoff-config";

export const dynamic = "force-dynamic";

/** Days from today to a cut-off date (negative = past). */
function daysLeft(cutOffDate: string | null): number | null {
  if (!cutOffDate) return null;
  const b = new Date(`${cutOffDate}T00:00:00Z`).getTime();
  if (Number.isNaN(b)) return null;
  const a = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`).getTime();
  return Math.round((b - a) / 86_400_000);
}

/**
 * GET /api/cutoff-monitoring/sites?projectId=&locationId=&status=&scope=
 * Detailed per-site cut-off & delivery list: period, cut-off date, days left,
 * submitted %, delivery state, and pending invoices — each with display meta,
 * sorted most urgent first. Cross-site (executive) access is restricted to
 * Leader/Super Admin. Falls back to mock cut-off rows when the DB is unavailable.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const projectId = sp.get("projectId") ?? undefined;
  const locationId = sp.get("locationId") ?? undefined;
  const status = sp.get("status") ?? undefined;
  const scope = (sp.get("scope") as "tenant" | "executive" | null) ?? (projectId ? "tenant" : "executive");
  const filter: CutoffFilter = { projectId, locationId, status, scope };

  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;
  const authz = authorizeDashboard(persona, filter);
  if (!authz.ok) {
    return NextResponse.json({ error: authz.message, role: persona.role }, { status: authz.status });
  }

  try {
    const rows = (await listCutoffMonitoring(filter)).filter((r) =>
      canAccessLocation(persona, r.locationId, r.projectId),
    );
    const sites = rows
      .map((r) => {
        const days = daysLeft(r.cutOffDate);
        return {
          projectCode: r.projectId,
          locationId: r.locationId,
          periodLabel: r.periodLabel,
          cutOffDate: r.cutOffDate,
          daysLeft: days,
          submittedPct: r.submittedPct,
          status: r.status,
          statusMeta: CUTOFF_STATUS_META[r.status],
          delivery: r.delivery,
          deliveryMeta: DELIVERY_STATUS_META[r.delivery],
          pendingInvoices: r.pendingInvoices,
        };
      })
      .sort((a, b) => (a.daysLeft ?? 9999) - (b.daysLeft ?? 9999));
    return NextResponse.json({ source: "db", filter, count: sites.length, sites });
  } catch {
    let scoped = SITE_KPI.filter((s) => canAccessLocation(persona, s.locationId, s.projectCode));
    if (projectId) scoped = scoped.filter((s) => s.projectCode === projectId);
    if (locationId) scoped = scoped.filter((s) => s.locationId === locationId);

    let rows = buildCutOffRows(scoped);
    if (status) rows = rows.filter((r) => r.status === status);
    const sites = rows.map((r) => ({
      projectCode: r.projectCode,
      locationId: r.locationId,
      locationName: r.locationName,
      periodLabel: r.periodLabel,
      cutOffDate: r.cutOffDate,
      daysLeft: r.daysLeft,
      submittedPct: r.submittedPct,
      status: r.status,
      statusMeta: CUTOFF_STATUS_META[r.status],
      delivery: r.delivery,
      deliveryMeta: DELIVERY_STATUS_META[r.delivery],
      pendingInvoices: r.pendingInvoices,
    }));
    return NextResponse.json({ source: "mock", filter, count: sites.length, sites });
  }
}
