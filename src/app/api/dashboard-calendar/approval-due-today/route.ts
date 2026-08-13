import { NextResponse, type NextRequest } from "next/server";
import { requirePersona } from "@/lib/server/rbac";
import { canAccessLocation } from "@/lib/personas";
import { SITE_KPI } from "@/lib/mock/site-kpi";
import { buildDeadlines } from "@/lib/mock/deadlines";

export const dynamic = "force-dynamic";

/**
 * GET /api/dashboard-calendar/approval-due-today?locationId=
 *
 * The approvals falling due today across the persona's accessible sites — the
 * approval-kind deadlines with a due-today status. Powers the Dashboard
 * Calendar's "approval jatuh tempo hari ini" list. Config-derived
 * (`buildDeadlines`), persona-scoped, optionally narrowed to one site.
 */
export async function GET(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;

  const locationId = req.nextUrl.searchParams.get("locationId") ?? undefined;
  let sites = SITE_KPI.filter((s) => canAccessLocation(persona, s.locationId, s.projectCode));
  if (locationId) sites = sites.filter((s) => s.locationId === locationId);

  const approvals = buildDeadlines(sites)
    .filter((d) => d.kind === "approval" && d.status === "due_today")
    .map((d) => ({
      id: d.id,
      title: d.title,
      projectCode: d.projectCode,
      locationId: d.locationId,
      locationName: d.locationName,
      owner: d.owner,
      dueDate: d.dueDate,
      dueLabel: d.dueLabel,
      progressPct: d.progressPct,
    }));

  return NextResponse.json({ source: "config", count: approvals.length, approvals });
}
