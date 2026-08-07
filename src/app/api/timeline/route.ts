import { NextResponse, type NextRequest } from "next/server";
import { listAggregateActivities, type ActivityFilter } from "@/db/repositories/invoice-activity-repository";
import { authorizeTimeline, requirePersona } from "@/lib/server/rbac";
import { parsePeriod } from "@/lib/server/period";
import { canAccessLocation } from "@/lib/personas";
import { SITE_KPI } from "@/lib/mock/site-kpi";
import { SITE_DETAILS } from "@/lib/mock/site-detail";
import { buildAggregateTimelines } from "@/lib/mock/aggregate-timeline";

export const dynamic = "force-dynamic";

/**
 * GET /api/timeline?projectId=&locationId=&action=&period=&from=&to=&limit=&scope=
 * Aggregate invoice-activity timeline across the sites the persona may see,
 * newest first, with optional project/location/action filters and a date window.
 * Cross-site (executive) access is restricted to Leader/Super Admin. Falls back
 * to mock aggregate timelines when the database is unavailable.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const projectId = sp.get("projectId") ?? undefined;
  const locationId = sp.get("locationId") ?? undefined;
  const action = sp.get("action") ?? undefined;
  const limitRaw = Number(sp.get("limit"));
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : undefined;
  const period = parsePeriod(sp, undefined, projectId);
  const scope = (sp.get("scope") as "tenant" | "executive" | null) ?? (projectId ? "tenant" : "executive");
  const filter: ActivityFilter = {
    projectId,
    locationId,
    action,
    from: period.from,
    to: period.to,
    limit,
    scope,
  };

  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;
  const authz = authorizeTimeline(persona, filter);
  if (!authz.ok) {
    return NextResponse.json({ error: authz.message, role: persona.role }, { status: authz.status });
  }

  try {
    const rows = (await listAggregateActivities(filter)).filter((r) =>
      canAccessLocation(persona, r.locationId, r.projectId),
    );
    return NextResponse.json({ source: "db", filter, count: rows.length, activities: rows });
  } catch {
    let sites = SITE_KPI.filter((s) => canAccessLocation(persona, s.locationId, s.projectCode));
    if (projectId) sites = sites.filter((s) => s.projectCode === projectId);
    if (locationId) sites = sites.filter((s) => s.locationId === locationId);

    const rows = buildAggregateTimelines(sites, SITE_DETAILS);
    return NextResponse.json({ source: "mock", filter, count: rows.length, timelines: rows });
  }
}
