import { NextResponse, type NextRequest } from "next/server";
import { requirePersona } from "@/lib/server/rbac";
import { canAccessLocation } from "@/lib/personas";
import { SITE_KPI } from "@/lib/mock/site-kpi";

export const dynamic = "force-dynamic";

/**
 * GET /api/sites?projectId=
 * Role-based site list for the global dashboard filter — returns only the sites
 * (and the projects grouping them) the calling persona may access, so the filter
 * dropdowns never expose out-of-scope sites. A Site Admin sees just their site(s);
 * Leader/Super Admin see their whole portfolio. Optional projectId narrows to one
 * project.
 */
export async function GET(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;

  const projectId = req.nextUrl.searchParams.get("projectId") ?? undefined;

  let accessible = SITE_KPI.filter((s) => canAccessLocation(persona, s.locationId, s.projectCode));
  if (projectId) accessible = accessible.filter((s) => s.projectCode === projectId);

  const sites = accessible.map((s) => ({
    projectCode: s.projectCode,
    projectName: s.projectName,
    locationId: s.locationId,
    locationName: s.locationName,
    invoicePeriod: s.invoicePeriod,
  }));

  // Group into projects for the two-level filter (project → site).
  const projectMap = new Map<string, { projectCode: string; projectName: string; locations: { locationId: string; locationName: string }[] }>();
  for (const s of accessible) {
    const entry =
      projectMap.get(s.projectCode) ??
      { projectCode: s.projectCode, projectName: s.projectName, locations: [] };
    entry.locations.push({ locationId: s.locationId, locationName: s.locationName });
    projectMap.set(s.projectCode, entry);
  }

  return NextResponse.json({
    role: persona.role,
    canCrossSite: persona.role === "super_admin" || persona.role === "leader_admin",
    siteCount: sites.length,
    projects: Array.from(projectMap.values()),
    sites,
  });
}
