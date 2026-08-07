import { NextResponse, type NextRequest } from "next/server";
import { getAttachmentById } from "@/db/repositories/invoice-attachment-repository";
import { getTransactionAttachmentById } from "@/db/repositories/transaction-attachment-repository";
import { requirePersona } from "@/lib/server/rbac";
import { canAccessLocation } from "@/lib/personas";

export const dynamic = "force-dynamic";

type ResolvedAttachment = {
  id: string;
  projectId: string;
  locationId: string;
  fileName: string;
  fileType: string | null;
  sizeBytes: number;
  storageKey: string | null;
};

/**
 * GET /api/attachments/:id/file?source=invoice|transaction&download=1
 * Resolves an attachment's file reference for preview or download, enforcing
 * that the persona may access its site. Storage is key-based (no binary held in
 * the DB), so the response returns the resolved storage key as preview/download
 * URLs plus the file metadata; `download=1` marks the intent as a download.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;

  const sp = req.nextUrl.searchParams;
  const source = sp.get("source") === "transaction" ? "transaction" : "invoice";
  const download = sp.get("download") === "1";

  try {
    let attachment: ResolvedAttachment | null = null;
    if (source === "invoice") {
      const row = await getAttachmentById(id);
      if (row) {
        attachment = {
          id: row.id,
          projectId: row.projectId,
          locationId: row.locationId,
          fileName: row.fileName,
          fileType: row.fileType,
          sizeBytes: row.sizeBytes,
          storageKey: row.storageKey,
        };
      }
    } else {
      const row = await getTransactionAttachmentById(id);
      if (row) {
        attachment = {
          id: row.id,
          projectId: row.projectId,
          locationId: row.locationId,
          fileName: row.fileName,
          fileType: row.fileType,
          sizeBytes: row.sizeBytes,
          storageKey: row.storageKey,
        };
      }
    }

    if (!attachment) return NextResponse.json({ error: "Lampiran tidak ditemukan." }, { status: 404 });
    if (!canAccessLocation(persona, attachment.locationId, attachment.projectId)) {
      return NextResponse.json({ error: "Tidak ada akses ke lampiran ini." }, { status: 403 });
    }
    if (!attachment.storageKey) {
      return NextResponse.json({ error: "File belum tersedia untuk lampiran ini." }, { status: 409 });
    }

    return NextResponse.json({
      source,
      id: attachment.id,
      fileName: attachment.fileName,
      fileType: attachment.fileType,
      sizeBytes: attachment.sizeBytes,
      mode: download ? "download" : "preview",
      previewUrl: attachment.storageKey,
      downloadUrl: attachment.storageKey,
    });
  } catch {
    return NextResponse.json({ error: "Database tidak tersedia." }, { status: 503 });
  }
}
