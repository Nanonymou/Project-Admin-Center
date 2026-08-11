import { NextResponse, type NextRequest } from "next/server";
import { requirePersona } from "@/lib/server/rbac";
import { canAccessLocation } from "@/lib/personas";
import { listInvoices } from "@/db/repositories/invoice-repository";
import { SITE_KPI } from "@/lib/mock/site-kpi";
import { buildDeadlines } from "@/lib/mock/deadlines";

export const dynamic = "force-dynamic";

/** Invoice-related deadline kinds (mirrors the shared UI predicate). */
const INVOICE_KINDS = new Set(["invoice_submit", "payment"]);

/**
 * GET /api/dashboard-calendar/invoice-due?locationId=
 *
 * Invoice due dates per site for the Dashboard Calendar, scoped to the persona.
 * Prefers real invoices (their due_date) from the DB; falls back to the config-
 * derived invoice deadlines (`buildDeadlines`, invoice kinds) when the DB is
 * unavailable so the calendar always has data. Optionally narrowed to one site.
 */
export async function GET(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;

  const locationId = req.nextUrl.searchParams.get("locationId") ?? undefined;
  let sites = SITE_KPI.filter((s) => canAccessLocation(persona, s.locationId, s.projectCode));
  if (locationId) sites = sites.filter((s) => s.locationId === locationId);

  try {
    // Real invoices, cross-site, then keep only those the persona may access.
    const rows = (await listInvoices({ scope: "executive" })).filter(
      (r) => r.dueDate && canAccessLocation(persona, r.locationId, r.projectId) && (!locationId || r.locationId === locationId),
    );
    if (rows.length === 0) throw new Error("empty");
    const dueDates = rows.map((r) => ({
      id: r.id,
      number: r.number,
      projectCode: r.projectId,
      locationId: r.locationId,
      dueDate: r.dueDate,
      amount: Number(r.amount),
      status: r.status,
    }));
    return NextResponse.json({ source: "db", count: dueDates.length, invoiceDueDates: dueDates });
  } catch {
    const dueDates = buildDeadlines(sites)
      .filter((d) => INVOICE_KINDS.has(d.kind))
      .map((d) => ({
        id: d.id,
        number: d.title,
        projectCode: d.projectCode,
        locationId: d.locationId,
        dueDate: d.dueDate,
        amount: null as number | null,
        status: d.status,
      }));
    return NextResponse.json({ source: "config", count: dueDates.length, invoiceDueDates: dueDates });
  }
}
