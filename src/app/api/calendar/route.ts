import { NextResponse, type NextRequest } from "next/server";
import { listDeadlines, type DeadlineFilter } from "@/db/repositories/deadline-repository";
import { authorizeDashboard, requirePersona } from "@/lib/server/rbac";
import { parsePeriod } from "@/lib/server/period";
import { canAccessLocation } from "@/lib/personas";
import { SITE_KPI } from "@/lib/mock/site-kpi";
import { buildDeadlines, type DeadlineItem, type DeadlineStatus } from "@/lib/mock/deadlines";

export const dynamic = "force-dynamic";

type CalendarEntry = {
  id: string;
  kind: string;
  title: string;
  projectCode: string;
  locationId: string;
  locationName?: string;
  owner?: string;
  dueDate: string;
  status: string;
  progressPct: number;
};

/** Count entries per status for the calendar legend / KPI strip. */
function summarize(entries: { status: string }[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of entries) out[e.status] = (out[e.status] ?? 0) + 1;
  return out;
}

/**
 * GET /api/calendar
 *   ?projectId=&locationId=&kind=&status=&period=&from=&to=&scope=
 *
 * Deadline calendar entries across the sites the persona may see, with optional
 * project/location/kind/status filters and a due-date window. Cross-site
 * (executive) access is restricted to Leader/Super Admin. Falls back to mock
 * deadlines when the database is unavailable.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const projectId = sp.get("projectId") ?? undefined;
  const locationId = sp.get("locationId") ?? undefined;
  const kind = sp.get("kind") ?? undefined;
  const status = sp.get("status") ?? undefined;
  const period = parsePeriod(sp, undefined, projectId);
  const scope = (sp.get("scope") as "tenant" | "executive" | null) ?? (projectId ? "tenant" : "executive");
  const filter: DeadlineFilter = {
    projectId,
    locationId,
    kind,
    status,
    from: period.from,
    to: period.to,
    scope,
  };

  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;
  const authz = authorizeDashboard(persona, filter);
  if (!authz.ok) {
    return NextResponse.json({ error: authz.message, role: persona.role }, { status: authz.status });
  }

  try {
    const rows = (await listDeadlines(filter)).filter((r) =>
      canAccessLocation(persona, r.locationId, r.projectId),
    );
    const entries: CalendarEntry[] = rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      title: r.title,
      projectCode: r.projectId,
      locationId: r.locationId,
      owner: r.owner ?? undefined,
      dueDate: r.dueDate,
      status: r.status,
      progressPct: r.progressPct,
    }));
    return NextResponse.json({ source: "db", filter, count: entries.length, summary: summarize(entries), entries });
  } catch {
    let sites = SITE_KPI.filter((s) => canAccessLocation(persona, s.locationId, s.projectCode));
    if (projectId) sites = sites.filter((s) => s.projectCode === projectId);
    if (locationId) sites = sites.filter((s) => s.locationId === locationId);

    let items: DeadlineItem[] = buildDeadlines(sites);
    if (kind) items = items.filter((i) => i.kind === kind);
    if (status) items = items.filter((i) => i.status === (status as DeadlineStatus));
    if (filter.from) items = items.filter((i) => i.dueDate >= filter.from!);
    if (filter.to) items = items.filter((i) => i.dueDate <= filter.to!);

    return NextResponse.json({
      source: "mock",
      filter,
      count: items.length,
      summary: summarize(items),
      entries: items,
    });
  }
}
