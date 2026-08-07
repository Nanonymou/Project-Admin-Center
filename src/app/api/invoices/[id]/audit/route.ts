import { NextResponse, type NextRequest } from "next/server";
import { getInvoiceById } from "@/db/repositories/invoice-repository";
import { listInvoiceActivities } from "@/db/repositories/invoice-activity-repository";
import { requirePersona } from "@/lib/server/rbac";
import { canAccessLocation } from "@/lib/personas";
import { SITE_KPI } from "@/lib/mock/site-kpi";
import { SITE_DETAILS } from "@/lib/mock/site-detail";
import { buildInvoiceAuditTrail } from "@/lib/mock/invoice-audit";

export const dynamic = "force-dynamic";

/**
 * GET /api/invoices/:id/audit
 * The invoice's audit trail (chronological activity log). Enforces that the
 * persona may access the invoice's site. Falls back to a synthesized trail when
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
    const activities = await listInvoiceActivities(id);
    return NextResponse.json({ source: "db", invoiceId: id, count: activities.length, activities });
  } catch {
    for (const site of SITE_KPI) {
      if (!canAccessLocation(persona, site.locationId, site.projectCode)) continue;
      const detail = SITE_DETAILS[site.locationId];
      if (!detail) continue;
      const inv = detail.invoices.find((i) => `${site.locationId}-${i.number}` === id);
      if (!inv) continue;
      const activities = buildInvoiceAuditTrail(inv);
      return NextResponse.json({ source: "mock", invoiceId: id, count: activities.length, activities });
    }
    return NextResponse.json({ error: "Invoice tidak ditemukan." }, { status: 404 });
  }
}
