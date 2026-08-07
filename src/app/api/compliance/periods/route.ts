import { NextResponse, type NextRequest } from "next/server";
import { listPeriods, type PeriodFilter } from "@/db/repositories/period-repository";
import { authorizeDashboard, requirePersona } from "@/lib/server/rbac";
import { canAccessLocation } from "@/lib/personas";
import { SITE_KPI } from "@/lib/mock/site-kpi";
import { evaluateInputPolicy } from "@/lib/server/services/cutoff-policy-service";
import { getInvoicePeriodRange } from "@/lib/mock/cutoff-config";

export const dynamic = "force-dynamic";

/**
 * GET /api/compliance/periods?projectId=&locationId=&scope=
 * Per-location period status for compliance monitoring: each site's current
 * period window, cut-off date, days remaining, and input-open status (from the
 * cut-off config), overlaid with the managed period lifecycle status from the
 * periods table when one exists. Scoped to the persona; cross-site (executive)
 * access is Leader/Super Admin only.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const projectId = sp.get("projectId") ?? undefined;
  const locationId = sp.get("locationId") ?? undefined;
  const scope = (sp.get("scope") as "tenant" | "executive" | null) ?? (projectId ? "tenant" : "executive");
  const filter: PeriodFilter = { projectId, locationId, scope };

  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;
  const authz = authorizeDashboard(persona, filter);
  if (!authz.ok) {
    return NextResponse.json({ error: authz.message, role: persona.role }, { status: authz.status });
  }

  // Config-derived base status per accessible site (always available).
  let sites = SITE_KPI.filter((s) => canAccessLocation(persona, s.locationId, s.projectCode));
  if (projectId) sites = sites.filter((s) => s.projectCode === projectId);
  if (locationId) sites = sites.filter((s) => s.locationId === locationId);

  const base = sites.map((s) => {
    const policy = evaluateInputPolicy(s.projectCode, s.locationId, s.locationName);
    const range = getInvoicePeriodRange(s.projectCode, new Date(), 0);
    return {
      projectCode: s.projectCode,
      locationId: s.locationId,
      locationName: s.locationName,
      periodLabel: range.label,
      periodStart: range.from,
      periodEnd: range.to,
      cutOffDate: policy.cutOffDate,
      daysUntilCutOff: policy.daysUntilCutOff,
      inputOpen: policy.inputOpen,
      cutoffStatus: policy.status,
      managedStatus: null as string | null,
    };
  });

  // Overlay managed period status from the DB when available (best-effort).
  try {
    const managed = (await listPeriods(filter)).filter((p) =>
      canAccessLocation(persona, p.locationId, p.projectId),
    );
    const latestByLoc = new Map<string, string>();
    for (const p of managed) {
      if (!latestByLoc.has(p.locationId)) latestByLoc.set(p.locationId, p.status);
    }
    for (const row of base) {
      const st = latestByLoc.get(row.locationId);
      if (st) row.managedStatus = st;
    }
    return NextResponse.json({ source: "db", filter, count: base.length, periods: base });
  } catch {
    return NextResponse.json({ source: "mock", filter, count: base.length, periods: base });
  }
}
