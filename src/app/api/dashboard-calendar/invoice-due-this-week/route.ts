import { NextResponse, type NextRequest } from "next/server";
import { requirePersona } from "@/lib/server/rbac";
import { canAccessLocation } from "@/lib/personas";
import { SITE_KPI } from "@/lib/mock/site-kpi";
import { buildDeadlines } from "@/lib/mock/deadlines";

export const dynamic = "force-dynamic";

const INVOICE_KINDS = new Set(["invoice_submit", "payment"]);

/**
 * GET /api/dashboard-calendar/invoice-due-this-week?locationId=
 *
 * Invoice deadlines falling within the next 7 days across the persona's
 * accessible sites, with an estimated total value (site monthly sales per
 * invoice deadline). Powers the Dashboard Calendar's this-week invoice summary.
 * Config-derived (`buildDeadlines`), persona-scoped, optionally one site.
 */
export async function GET(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;

  const locationId = req.nextUrl.searchParams.get("locationId") ?? undefined;
  let sites = SITE_KPI.filter((s) => canAccessLocation(persona, s.locationId, s.projectCode));
  if (locationId) sites = sites.filter((s) => s.locationId === locationId);

  const salesByLocation = new Map(sites.map((s) => [s.locationId, s.sales]));

  const items = buildDeadlines(sites)
    .filter((d) => INVOICE_KINDS.has(d.kind) && d.daysRelative >= 0 && d.daysRelative <= 7)
    .sort((a, b) => a.daysRelative - b.daysRelative)
    .map((d) => ({
      id: d.id,
      title: d.title,
      projectCode: d.projectCode,
      locationId: d.locationId,
      locationName: d.locationName,
      dueDate: d.dueDate,
      dueLabel: d.dueLabel,
      status: d.status,
      estimatedValue: salesByLocation.get(d.locationId) ?? 0,
    }));

  const total = items.reduce((sum, i) => sum + i.estimatedValue, 0);

  return NextResponse.json({ source: "config", count: items.length, estimatedTotal: total, items });
}
