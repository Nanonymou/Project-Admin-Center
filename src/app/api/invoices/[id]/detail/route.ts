import { NextResponse, type NextRequest } from "next/server";
import { getInvoiceById } from "@/db/repositories/invoice-repository";
import { listAttachments } from "@/db/repositories/invoice-attachment-repository";
import { listInvoiceActivities } from "@/db/repositories/invoice-activity-repository";
import { computeInvoice } from "@/lib/server/services/invoice-calculation-service";
import { requirePersona } from "@/lib/server/rbac";
import { canAccessLocation } from "@/lib/personas";
import { SITE_KPI } from "@/lib/mock/site-kpi";
import { SITE_DETAILS } from "@/lib/mock/site-detail";
import { buildInvoiceAuditTrail } from "@/lib/mock/invoice-audit";

export const dynamic = "force-dynamic";

/**
 * GET /api/invoices/:id/detail
 * Full invoice detail: the invoice, its recomputed financials, attachments, and
 * the audit trail (invoice_activities). Enforces that the persona may access the
 * invoice's site. Falls back to a mock invoice + synthesized audit trail when
 * the database is unavailable (id treated as "<locationId>-<number>").
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
    const [attachments, activities] = await Promise.all([
      listAttachments(id),
      listInvoiceActivities(id),
    ]);
    const calc = computeInvoice({
      projectCode: invoice.projectId,
      subtotal: Number(invoice.subtotal),
      deduction: Number(invoice.deduction),
    });
    return NextResponse.json({ source: "db", invoice, calc, attachments, activities });
  } catch {
    // Mock fallback: locate the invoice by its "<locationId>-<number>" id.
    for (const site of SITE_KPI) {
      if (!canAccessLocation(persona, site.locationId, site.projectCode)) continue;
      const detail = SITE_DETAILS[site.locationId];
      if (!detail) continue;
      const inv = detail.invoices.find((i) => `${site.locationId}-${i.number}` === id);
      if (!inv) continue;
      const calc = computeInvoice({ projectCode: site.projectCode, subtotal: inv.amount });
      return NextResponse.json({
        source: "mock",
        invoice: { ...inv, projectCode: site.projectCode, locationId: site.locationId },
        calc,
        attachments: [],
        activities: buildInvoiceAuditTrail(inv),
      });
    }
    return NextResponse.json({ error: "Invoice tidak ditemukan." }, { status: 404 });
  }
}
