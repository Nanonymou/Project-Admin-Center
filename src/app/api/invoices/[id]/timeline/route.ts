import { NextResponse, type NextRequest } from "next/server";
import { getInvoiceById } from "@/db/repositories/invoice-repository";
import { listStageProgressForInvoice } from "@/db/repositories/invoice-stage-progress-repository";
import { buildTimeline } from "@/lib/server/services/invoice-timeline-service";
import { requirePersona } from "@/lib/server/rbac";
import { canAccessLocation } from "@/lib/personas";
import { SITE_KPI } from "@/lib/mock/site-kpi";
import { SITE_DETAILS } from "@/lib/mock/site-detail";

export const dynamic = "force-dynamic";

/**
 * GET /api/invoices/:id/timeline
 * The invoice's processing timeline — its stage-progress rows in order. When no
 * persisted progress exists (or the DB is unavailable), the timeline is
 * synthesized from the config-driven approval stages so the page always renders.
 * Enforces that the persona may access the invoice's site.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;

  try {
    const invoice = await getInvoiceById(id);
    if (!invoice) return NextResponse.json({ error: "Invoice tidak ditemukan." }, { status: 404 });
    if (!canAccessLocation(persona, invoice.locationId, invoice.projectId)) {
      return NextResponse.json({ error: "Tidak ada akses ke invoice ini." }, { status: 403 });
    }
    const rows = await listStageProgressForInvoice(id);
    if (rows.length > 0) {
      return NextResponse.json({ source: "db", invoiceId: id, count: rows.length, stages: rows });
    }
    // No persisted progress yet — synthesize from config.
    const stages = buildTimeline(invoice.projectId, `${invoice.locationId}-${invoice.number}`);
    return NextResponse.json({ source: "config", invoiceId: id, count: stages.length, stages });
  } catch {
    // Mock fallback: locate the invoice by its "<locationId>-<number>" id.
    for (const site of SITE_KPI) {
      if (!canAccessLocation(persona, site.locationId, site.projectCode)) continue;
      const detail = SITE_DETAILS[site.locationId];
      if (!detail) continue;
      const inv = detail.invoices.find((i) => `${site.locationId}-${i.number}` === id);
      if (!inv) continue;
      const stages = buildTimeline(site.projectCode, `${site.locationId}-${inv.number}`);
      return NextResponse.json({ source: "mock", invoiceId: id, count: stages.length, stages });
    }
    return NextResponse.json({ error: "Invoice tidak ditemukan." }, { status: 404 });
  }
}
