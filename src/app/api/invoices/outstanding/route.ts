import { NextResponse, type NextRequest } from "next/server";
import { listOutstandingInvoices, type InvoiceFilter } from "@/db/repositories/invoice-repository";
import { authorizeDashboard, requirePersona } from "@/lib/server/rbac";
import { parsePeriod } from "@/lib/server/period";
import { canAccessLocation } from "@/lib/personas";
import { SITE_KPI } from "@/lib/mock/site-kpi";
import { SITE_DETAILS } from "@/lib/mock/site-detail";
import { buildOutstandingInvoicesFor, summarizeOutstanding } from "@/lib/mock/outstanding";

export const dynamic = "force-dynamic";

/**
 * GET /api/invoices/outstanding
 *   ?projectId=&locationId=&status=&stage=&agingBucket=&period=&from=&to=&scope=
 *
 * Lists outstanding invoices (not yet settled, or overdue) across the sites the
 * persona may see, with optional project/location/status/stage/aging filters.
 * Cross-site (executive) access is restricted to Leader/Super Admin. Falls back
 * to mock aggregation when the database is unavailable so the endpoint always
 * responds.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const projectId = sp.get("projectId") ?? undefined;
  const locationId = sp.get("locationId") ?? undefined;
  const status = sp.get("status") ?? undefined;
  const stage = sp.get("stage") ?? undefined;
  const agingBucket = sp.get("agingBucket") ?? undefined;
  const period = parsePeriod(sp, undefined, projectId);
  const filter: InvoiceFilter = {
    projectId,
    locationId,
    status,
    stage,
    agingBucket,
    from: period.from,
    to: period.to,
    scope: (sp.get("scope") as "tenant" | "executive" | null) ?? (projectId ? "tenant" : "executive"),
  };

  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;
  const authz = authorizeDashboard(persona, filter);
  if (!authz.ok) {
    return NextResponse.json({ error: authz.message, role: persona.role }, { status: authz.status });
  }

  try {
    const rows = (await listOutstandingInvoices(filter)).filter((r) =>
      canAccessLocation(persona, r.locationId, r.projectId),
    );
    const items = rows.map((r) => ({
      id: r.id,
      invoiceNumber: r.number,
      amount: Number(r.amount),
      projectCode: r.projectId,
      locationId: r.locationId,
      locationName: r.locationId,
      stage: r.stage,
      status: r.status,
      agingBucket: r.agingBucket,
      dueDate: r.dueDate ?? "",
      pic: r.pic ?? "",
    }));
    return NextResponse.json({ source: "db", filter, count: items.length, items });
  } catch {
    // Mock fallback scoped to the persona's accessible sites.
    let sites = SITE_KPI.filter((s) => canAccessLocation(persona, s.locationId, s.projectCode));
    if (projectId) sites = sites.filter((s) => s.projectCode === projectId);
    if (locationId) sites = sites.filter((s) => s.locationId === locationId);

    let items = buildOutstandingInvoicesFor(sites, SITE_DETAILS);
    if (status) items = items.filter((i) => i.status === status);
    if (stage) items = items.filter((i) => i.stage === stage);
    if (agingBucket) items = items.filter((i) => i.agingBucket === agingBucket);

    return NextResponse.json({
      source: "mock",
      filter,
      count: items.length,
      items,
      summary: summarizeOutstanding(items),
    });
  }
}
