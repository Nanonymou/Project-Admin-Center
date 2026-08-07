import { NextResponse, type NextRequest } from "next/server";
import {
  foldCutoffStats,
  listCutoffMonitoring,
  type CutoffFilter,
} from "@/db/repositories/cutoff-monitoring-repository";
import { authorizeDashboard, requirePersona } from "@/lib/server/rbac";
import { canAccessLocation } from "@/lib/personas";
import { SITE_KPI } from "@/lib/mock/site-kpi";
import { buildCutOffRows } from "@/lib/mock/cutoff-config";

export const dynamic = "force-dynamic";

/**
 * GET /api/cutoff-monitoring?projectId=&locationId=&status=&scope=
 * Leader-dashboard statistics for cut-off & delivery monitoring: per-site rows
 * plus folded stats (counts by status/delivery, average submitted %, critical
 * sites, pending invoices). Cross-site (executive) access is restricted to
 * Leader/Super Admin. Falls back to mock cut-off rows when the database is
 * unavailable.
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
    return NextResponse.json({ source: "db", filter, stats: foldCutoffStats(rows), rows });
  } catch {
    let sites = SITE_KPI.filter((s) => canAccessLocation(persona, s.locationId, s.projectCode));
    if (projectId) sites = sites.filter((s) => s.projectCode === projectId);
    if (locationId) sites = sites.filter((s) => s.locationId === locationId);

    let rows = buildCutOffRows(sites);
    if (status) rows = rows.filter((r) => r.status === status);
    const stats = foldCutoffStats(
      rows.map((r) => ({
        status: r.status,
        delivery: r.delivery,
        submittedPct: r.submittedPct,
        pendingInvoices: r.pendingInvoices,
      })),
    );
    return NextResponse.json({ source: "mock", filter, stats, rows });
  }
}
