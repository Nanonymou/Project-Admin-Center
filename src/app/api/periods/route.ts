import { NextResponse, type NextRequest } from "next/server";
import { listPeriods, type PeriodFilter } from "@/db/repositories/period-repository";
import { authorizeDashboard, requirePersona } from "@/lib/server/rbac";
import { canAccessLocation } from "@/lib/personas";
import { SITE_KPI } from "@/lib/mock/site-kpi";
import { getInvoicePeriodRange, getInvoicePeriodType, daysUntilCutOff } from "@/lib/mock/cutoff-config";

export const dynamic = "force-dynamic";

/**
 * GET /api/periods?projectId=&locationId=&status=&scope=
 * Lists managed periods with their status per site, scoped to the persona.
 * Cross-site (executive) access is restricted to Leader/Super Admin. Falls back
 * to config-derived current/previous periods when the database is unavailable.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const projectId = sp.get("projectId") ?? undefined;
  const locationId = sp.get("locationId") ?? undefined;
  const status = sp.get("status") ?? undefined;
  const scope = (sp.get("scope") as "tenant" | "executive" | null) ?? (projectId ? "tenant" : "executive");
  const filter: PeriodFilter = { projectId, locationId, status, scope };

  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;
  const authz = authorizeDashboard(persona, filter);
  if (!authz.ok) {
    return NextResponse.json({ error: authz.message, role: persona.role }, { status: authz.status });
  }

  try {
    const rows = (await listPeriods(filter)).filter((r) =>
      canAccessLocation(persona, r.locationId, r.projectId),
    );
    return NextResponse.json({ source: "db", filter, count: rows.length, periods: rows });
  } catch {
    let sites = SITE_KPI.filter((s) => canAccessLocation(persona, s.locationId, s.projectCode));
    if (projectId) sites = sites.filter((s) => s.projectCode === projectId);
    if (locationId) sites = sites.filter((s) => s.locationId === locationId);

    // Synthesize the current and previous period per site from the cut-off config.
    const periodsOut = sites.flatMap((s) => {
      const type = getInvoicePeriodType(s.projectCode);
      const days = daysUntilCutOff(s.projectCode);
      const current = getInvoicePeriodRange(s.projectCode, new Date(), 0);
      const previous = getInvoicePeriodRange(s.projectCode, new Date(), -1);
      return [
        {
          projectCode: s.projectCode,
          locationId: s.locationId,
          periodLabel: current.label,
          periodType: type,
          periodStart: current.from,
          periodEnd: current.to,
          status: days <= 0 ? "closing" : "open",
        },
        {
          projectCode: s.projectCode,
          locationId: s.locationId,
          periodLabel: previous.label,
          periodType: type,
          periodStart: previous.from,
          periodEnd: previous.to,
          status: "closed",
        },
      ];
    });
    const out = status ? periodsOut.filter((p) => p.status === status) : periodsOut;
    return NextResponse.json({ source: "mock", filter, count: out.length, periods: out });
  }
}
