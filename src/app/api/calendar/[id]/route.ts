import { NextResponse, type NextRequest } from "next/server";
import { getDeadlineById } from "@/db/repositories/deadline-repository";
import { requirePersona } from "@/lib/server/rbac";
import { canAccessLocation } from "@/lib/personas";
import { SITE_KPI } from "@/lib/mock/site-kpi";
import { buildDeadlines } from "@/lib/mock/deadlines";

export const dynamic = "force-dynamic";

type CalendarItemDetail = {
  id: string;
  kind: string;
  title: string;
  projectCode: string;
  locationId: string;
  owner?: string;
  dueDate: string;
  status: string;
};

/** Days from today to the due date (negative = overdue). */
function daysRelativeTo(dueDate: string, ref = new Date()): number {
  const a = new Date(`${ref.toISOString().slice(0, 10)}T00:00:00Z`).getTime();
  const b = new Date(`${dueDate}T00:00:00Z`).getTime();
  if (Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

/** Enrich a single deadline with a computed days-relative for the detail view. */
function enrich(input: CalendarItemDetail) {
  return { ...input, daysRelative: daysRelativeTo(input.dueDate) };
}

/**
 * GET /api/calendar/:id
 * Returns a single deadline calendar item, enforcing that the caller's persona
 * may access its site. Falls back to locating the item among mock deadlines when
 * the database is unavailable.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;

  try {
    const row = await getDeadlineById(id);
    if (!row) return NextResponse.json({ error: "Deadline tidak ditemukan." }, { status: 404 });
    if (!canAccessLocation(persona, row.locationId, row.projectId)) {
      return NextResponse.json({ error: "Tidak ada akses ke item ini." }, { status: 403 });
    }
    return NextResponse.json({
      source: "db",
      item: enrich({
        id: row.id,
        kind: row.kind,
        title: row.title,
        projectCode: row.projectId,
        locationId: row.locationId,
        owner: row.owner ?? undefined,
        dueDate: row.dueDate,
        status: row.status,
      }),
    });
  } catch {
    const sites = SITE_KPI.filter((s) => canAccessLocation(persona, s.locationId, s.projectCode));
    const item = buildDeadlines(sites).find((d) => d.id === id);
    if (!item) return NextResponse.json({ error: "Deadline tidak ditemukan." }, { status: 404 });
    return NextResponse.json({ source: "mock", item });
  }
}
