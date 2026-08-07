import { NextResponse, type NextRequest } from "next/server";
import { authorizeDashboard, requirePersona } from "@/lib/server/rbac";
import { canAccessLocation } from "@/lib/personas";
import { SITE_KPI } from "@/lib/mock/site-kpi";
import {
  evaluateInputForDate,
  evaluateInputPolicy,
} from "@/lib/server/services/cutoff-policy-service";

export const dynamic = "force-dynamic";

/**
 * GET /api/cutoff-policy?projectId=&locationId=&date=&scope=
 * Cut-off input-policy status per site: the current period's cut-off date, days
 * remaining, and whether daily input is still open (config-driven, H+1 rule).
 * When `date` is given, also returns whether input for that date is allowed / late.
 * Scoped to the persona; cross-site (executive) access is Leader/Super Admin only.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const projectId = sp.get("projectId") ?? undefined;
  const locationId = sp.get("locationId") ?? undefined;
  const date = sp.get("date") ?? undefined;
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

  const policies = sites.map((s) =>
    evaluateInputPolicy(s.projectCode, s.locationId, s.locationName),
  );
  const dateCheck = date ? evaluateInputForDate(date) : undefined;

  return NextResponse.json({
    source: "service",
    filter,
    date,
    dateCheck,
    count: policies.length,
    policies,
  });
}
