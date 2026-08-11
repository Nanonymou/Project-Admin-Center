import { NextResponse, type NextRequest } from "next/server";
import { requirePersona } from "@/lib/server/rbac";
import { canAccessLocation } from "@/lib/personas";
import { SITE_KPI } from "@/lib/mock/site-kpi";
import { buildDeadlines } from "@/lib/mock/deadlines";

export const dynamic = "force-dynamic";

/**
 * GET /api/dashboard-calendar/client-approval?locationId=
 *
 * Client approval reminders across the persona's accessible sites — the payment-
 * confirmation deadlines that await the client's sign-off/payment (outside the
 * internal approval flow), most urgent first. Powers the Dashboard Calendar's
 * client-approval reminders. Config-derived, persona-scoped, optionally one site.
 */
export async function GET(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;

  const locationId = req.nextUrl.searchParams.get("locationId") ?? undefined;
  let sites = SITE_KPI.filter((s) => canAccessLocation(persona, s.locationId, s.projectCode));
  if (locationId) sites = sites.filter((s) => s.locationId === locationId);

  const reminders = buildDeadlines(sites)
    .filter((d) => d.kind === "payment" && d.status !== "settled")
    .sort((a, b) => a.daysRelative - b.daysRelative)
    .map((d) => ({
      id: d.id,
      title: d.title,
      projectCode: d.projectCode,
      locationId: d.locationId,
      locationName: d.locationName,
      owner: d.owner,
      dueDate: d.dueDate,
      dueLabel: d.dueLabel,
      status: d.status,
    }));

  return NextResponse.json({ source: "config", count: reminders.length, reminders });
}
