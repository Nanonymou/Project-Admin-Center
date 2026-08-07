import { NextResponse, type NextRequest } from "next/server";
import { getInvoiceById } from "@/db/repositories/invoice-repository";
import {
  deleteAttachment,
  getAttachmentById,
} from "@/db/repositories/invoice-attachment-repository";
import { requirePersona } from "@/lib/server/rbac";
import { canAccessLocation } from "@/lib/personas";

export const dynamic = "force-dynamic";

/**
 * GET /api/invoices/:id/attachments/:attachmentId — single attachment metadata.
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; attachmentId: string }> },
) {
  const { id, attachmentId } = await ctx.params;
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  try {
    const attachment = await getAttachmentById(attachmentId);
    if (!attachment || attachment.invoiceId !== id) {
      return NextResponse.json({ error: "Lampiran tidak ditemukan." }, { status: 404 });
    }
    if (!canAccessLocation(auth.persona, attachment.locationId, attachment.projectId)) {
      return NextResponse.json({ error: "Tidak ada akses ke lampiran ini." }, { status: 403 });
    }
    return NextResponse.json({ source: "db", attachment });
  } catch {
    return NextResponse.json({ error: "Database tidak tersedia." }, { status: 503 });
  }
}

/**
 * DELETE /api/invoices/:id/attachments/:attachmentId — remove an attachment.
 * Viewers cannot delete; the persona must have access to the invoice's site.
 */
export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; attachmentId: string }> },
) {
  const { id, attachmentId } = await ctx.params;
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;
  if (persona.role === "viewer") {
    return NextResponse.json({ error: "Viewer tidak dapat menghapus lampiran." }, { status: 403 });
  }

  try {
    const attachment = await getAttachmentById(attachmentId);
    if (!attachment || attachment.invoiceId !== id) {
      return NextResponse.json({ error: "Lampiran tidak ditemukan." }, { status: 404 });
    }
    // Defence in depth: the attachment's own tenancy and the invoice must both be
    // in the persona's scope.
    const invoice = await getInvoiceById(id);
    if (!invoice || !canAccessLocation(persona, invoice.locationId, invoice.projectId)) {
      return NextResponse.json({ error: "Tidak ada akses ke lampiran ini." }, { status: 403 });
    }
    const removed = await deleteAttachment(attachmentId);
    return NextResponse.json({ source: "db", deleted: removed });
  } catch {
    return NextResponse.json({ error: "Database tidak tersedia." }, { status: 503 });
  }
}
