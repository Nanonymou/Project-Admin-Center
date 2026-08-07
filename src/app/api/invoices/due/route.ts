import { NextResponse, type NextRequest } from "next/server";
import { listInvoices, type InvoiceFilter } from "@/db/repositories/invoice-repository";
import { authorizeDashboard, requirePersona } from "@/lib/server/rbac";
import { canAccessLocation } from "@/lib/personas";
import { SITE_KPI } from "@/lib/mock/site-kpi";
import { SITE_DETAILS } from "@/lib/mock/site-detail";

export const dynamic = "force-dynamic";

function remainingDays(dueDate: string | null, ref = new Date()): number | null {
  if (!dueDate) return null;
  const b = new Date(`${dueDate}T00:00:00Z`).getTime();
  if (Number.isNaN(b)) return null;
  const a = new Date(`${ref.toISOString().slice(0, 10)}T00:00:00Z`).getTime();
  return Math.round((b - a) / 86_400_000);
}

/** Urgency bucket from remaining days. */
function urgency(days: number | null): "overdue" | "due_today" | "due_soon" | "upcoming" | "unknown" {
  if (days === null) return "unknown";
  if (days < 0) return "overdue";
  if (days === 0) return "due_today";
  if (days <= 7) return "due_soon";
  return "upcoming";
}

/**
 * GET /api/invoices/due?projectId=&locationId=&scope=
 * Lists unsettled invoices with the days remaining until their due date and an
 * urgency bucket, most urgent first — scoped to the persona. Cross-site
 * (executive) access is restricted to Leader/Super Admin. Falls back to mock
 * invoices when the database is unavailable.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const projectId = sp.get("projectId") ?? undefined;
  const locationId = sp.get("locationId") ?? undefined;
  const scope = (sp.get("scope") as "tenant" | "executive" | null) ?? (projectId ? "tenant" : "executive");
  const filter: InvoiceFilter = { projectId, locationId, scope };

  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;
  const authz = authorizeDashboard(persona, filter);
  if (!authz.ok) {
    return NextResponse.json({ error: authz.message, role: persona.role }, { status: authz.status });
  }

  try {
    const rows = (await listInvoices(filter))
      .filter((r) => r.status !== "settled" && canAccessLocation(persona, r.locationId, r.projectId))
      .map((r) => {
        const days = remainingDays(r.dueDate);
        return {
          id: r.id,
          number: r.number,
          projectCode: r.projectId,
          locationId: r.locationId,
          amount: Number(r.amount),
          dueDate: r.dueDate,
          remainingDays: days,
          urgency: urgency(days),
          stage: r.stage,
          status: r.status,
        };
      })
      .sort((a, b) => (a.remainingDays ?? 9999) - (b.remainingDays ?? 9999));
    return NextResponse.json({ source: "db", filter, count: rows.length, invoices: rows });
  } catch {
    let sites = SITE_KPI.filter((s) => canAccessLocation(persona, s.locationId, s.projectCode));
    if (projectId) sites = sites.filter((s) => s.projectCode === projectId);
    if (locationId) sites = sites.filter((s) => s.locationId === locationId);
    const invoices = sites
      .flatMap((s) => {
        const detail = SITE_DETAILS[s.locationId];
        if (!detail) return [];
        return detail.invoices
          .filter((inv) => inv.stage !== "Payment")
          .map((inv) => {
            const days = remainingDays(inv.dueDate);
            return {
              id: `${s.locationId}-${inv.number}`,
              number: inv.number,
              projectCode: s.projectCode,
              locationId: s.locationId,
              amount: inv.amount,
              dueDate: inv.dueDate,
              remainingDays: days,
              urgency: urgency(days),
              stage: inv.stage,
              status: inv.status,
            };
          });
      })
      .sort((a, b) => (a.remainingDays ?? 9999) - (b.remainingDays ?? 9999));
    return NextResponse.json({ source: "mock", filter, count: invoices.length, invoices });
  }
}
