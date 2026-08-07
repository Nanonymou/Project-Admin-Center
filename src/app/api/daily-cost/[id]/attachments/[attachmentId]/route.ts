import { NextResponse, type NextRequest } from "next/server";
import {
  deleteTransactionAttachment,
  getTransactionAttachmentById,
} from "@/db/repositories/transaction-attachment-repository";
import { requirePersona } from "@/lib/server/rbac";
import { canAccessLocation } from "@/lib/personas";

export const dynamic = "force-dynamic";

/**
 * GET /api/daily-cost/:id/attachments/:attachmentId
 * Access a single proof-file attachment's metadata (and storage key). Enforces
 * that the attachment belongs to the transaction and the persona may access its
 * site.
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; attachmentId: string }> },
) {
  const { id, attachmentId } = await ctx.params;
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  try {
    const attachment = await getTransactionAttachmentById(attachmentId);
    if (!attachment || attachment.transactionId !== id) {
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
 * DELETE /api/daily-cost/:id/attachments/:attachmentId
 * Remove a proof-file attachment. Viewers cannot delete; the persona must have
 * access to the transaction's site.
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
    const attachment = await getTransactionAttachmentById(attachmentId);
    if (!attachment || attachment.transactionId !== id) {
      return NextResponse.json({ error: "Lampiran tidak ditemukan." }, { status: 404 });
    }
    if (!canAccessLocation(persona, attachment.locationId, attachment.projectId)) {
      return NextResponse.json({ error: "Tidak ada akses ke lampiran ini." }, { status: 403 });
    }
    const removed = await deleteTransactionAttachment(attachmentId);
    return NextResponse.json({ source: "db", deleted: removed });
  } catch {
    return NextResponse.json({ error: "Database tidak tersedia." }, { status: 503 });
  }
}
