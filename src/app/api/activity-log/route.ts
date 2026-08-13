import { NextResponse, type NextRequest } from "next/server";
import { requirePersona } from "@/lib/server/rbac";
import { canAccessLocation, canAccessProject } from "@/lib/personas";
import { listActivityLogs, type ActivityLogFilter } from "@/db/repositories/activity-log-repository";
import { filterByLocationScope } from "@/lib/server/guards/site-scope-filter";
import { SITE_KPI } from "@/lib/mock/site-kpi";
import { buildAuditTrail } from "@/lib/mock/audit-trail";

export const dynamic = "force-dynamic";

/**
 * GET /api/activity-log?projectId=&locationId=&actor=&action=&q=&from=&to=&limit=
 *
 * The operational activity feed, newest first, scoped to the persona: only rows
 * for sites the persona can access are returned (defense-in-depth on top of any
 * explicit project/location filter). Falls back to the config-derived trail when
 * the DB is unavailable. Any authenticated persona may read within their scope.
 */
export async function GET(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;

  const sp = req.nextUrl.searchParams;
  const projectId = sp.get("projectId") ?? undefined;
  const locationId = sp.get("locationId") ?? undefined;
  const actor = sp.get("actor") ?? undefined;
  const action = sp.get("action") ?? undefined;
  const q = (sp.get("q") ?? "").trim().toLowerCase();
  const from = sp.get("from") ?? undefined;
  const to = sp.get("to") ?? undefined;
  const limitRaw = Number(sp.get("limit"));
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : undefined;

  // Explicit filter must be within scope.
  if (projectId && !canAccessProject(persona, projectId)) {
    return NextResponse.json({ error: `Tidak ada akses ke project ${projectId}.` }, { status: 403 });
  }
  if (locationId && projectId && !canAccessLocation(persona, locationId, projectId)) {
    return NextResponse.json({ error: `Tidak ada akses ke lokasi ${locationId}.` }, { status: 403 });
  }

  const filter: ActivityLogFilter = { projectCode: projectId, locationId, actor, action, from, to, limit };

  try {
    const rows = await listActivityLogs(filter);
    if (rows.length === 0) throw new Error("empty");
    // Scope-filter rows (a row with no project is org-wide → visible).
    const scoped = filterByLocationScope(persona, rows, (r) => ({
      projectCode: r.projectCode ?? "",
      locationId: r.locationId ?? "",
    }));
    const filtered = q
      ? scoped.filter((r) => `${r.actor} ${r.detail} ${r.target} ${r.action}`.toLowerCase().includes(q))
      : scoped;
    return NextResponse.json({
      source: "db",
      count: filtered.length,
      logs: filtered.map((r) => ({
        id: r.id,
        action: r.action,
        actor: r.actor,
        role: r.role,
        target: r.target,
        projectCode: r.projectCode,
        locationId: r.locationId,
        detail: r.detail,
        at: r.createdAt,
      })),
    });
  } catch {
    const sites = SITE_KPI.filter((s) => canAccessLocation(persona, s.locationId, s.projectCode));
    let entries = buildAuditTrail(sites);
    if (locationId) entries = entries.filter((e) => e.locationId === locationId);
    if (action) entries = entries.filter((e) => e.action === action);
    if (actor) entries = entries.filter((e) => e.actor === actor);
    if (q) entries = entries.filter((e) => `${e.actor} ${e.detail} ${e.target}`.toLowerCase().includes(q));
    if (limit) entries = entries.slice(0, limit);
    return NextResponse.json({
      source: "config",
      count: entries.length,
      logs: entries.map((e) => ({
        id: e.id,
        action: e.action,
        actor: e.actor,
        role: e.role,
        target: e.target,
        projectCode: e.projectCode,
        locationId: e.locationId,
        detail: e.detail,
        at: e.timeLabel,
      })),
    });
  }
}
