import { NextResponse, type NextRequest } from "next/server";
import { requirePersona } from "@/lib/server/rbac";
import { canAccessLocation } from "@/lib/personas";
import { SITE_KPI } from "@/lib/mock/site-kpi";
import { buildDeadlines } from "@/lib/mock/deadlines";

export const dynamic = "force-dynamic";

/** Deadline kinds that require sending documents to an external party. */
const DELIVERY_KINDS = new Set(["invoice_submit", "audit"]);

/**
 * GET /api/dashboard-calendar/document-delivery?locationId=
 *
 * Reminders for deadlines that require delivering documents to a counterparty
 * (invoice submission to client, audit support) across the persona's accessible
 * sites, upcoming first and excluding settled ones. Powers the Dashboard
 * Calendar's document-delivery reminders. Config-derived, persona-scoped.
 */
export async function GET(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;

  const locationId = req.nextUrl.searchParams.get("locationId") ?? undefined;
  let sites = SITE_KPI.filter((s) => canAccessLocation(persona, s.locationId, s.projectCode));
  if (locationId) sites = sites.filter((s) => s.locationId === locationId);

  const reminders = buildDeadlines(sites)
    .filter((d) => DELIVERY_KINDS.has(d.kind) && d.status !== "settled")
    .sort((a, b) => a.daysRelative - b.daysRelative)
    .map((d) => ({
      id: d.id,
      kind: d.kind,
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
