import { NextResponse, type NextRequest } from "next/server";
import { requirePersona } from "@/lib/server/rbac";
import { canAccessLocation } from "@/lib/personas";
import { SITE_KPI } from "@/lib/mock/site-kpi";
import { buildDeadlines } from "@/lib/mock/deadlines";

export const dynamic = "force-dynamic";

/**
 * GET /api/dashboard-calendar/approval-overdue?locationId=
 *
 * Overdue approvals across the persona's accessible sites — the approval-kind
 * deadlines with an overdue status, each with how many days late, sorted
 * most-overdue first. Powers the Dashboard Calendar's overdue-approvals list.
 * Config-derived (`buildDeadlines`), persona-scoped, optionally one site.
 */
export async function GET(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;

  const locationId = req.nextUrl.searchParams.get("locationId") ?? undefined;
  let sites = SITE_KPI.filter((s) => canAccessLocation(persona, s.locationId, s.projectCode));
  if (locationId) sites = sites.filter((s) => s.locationId === locationId);

  const approvals = buildDeadlines(sites)
    .filter((d) => d.kind === "approval" && d.status === "overdue")
    .sort((a, b) => a.daysRelative - b.daysRelative)
    .map((d) => ({
      id: d.id,
      title: d.title,
      projectCode: d.projectCode,
      locationId: d.locationId,
      locationName: d.locationName,
      owner: d.owner,
      dueDate: d.dueDate,
      daysLate: Math.abs(d.daysRelative),
      progressPct: d.progressPct,
    }));

  return NextResponse.json({ source: "config", count: approvals.length, approvals });
}
