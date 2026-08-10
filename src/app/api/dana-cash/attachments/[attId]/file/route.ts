import { NextResponse, type NextRequest } from "next/server";
import { getDanaCashAttachmentById } from "@/db/repositories/dana-cash-attachment-repository";
import { requirePersona } from "@/lib/server/rbac";
import { canAccessLocation } from "@/lib/personas";
import { classifyPreview, isPreviewable } from "@/lib/server/file-types";

export const dynamic = "force-dynamic";

/**
 * GET /api/dana-cash/attachments/:attId/file?download=1
 * Resolves a Dana Cash attachment's file reference for preview or download,
 * enforcing site access. Storage is key-based, so the response returns the
 * storage key as preview/download URLs plus the file metadata.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ attId: string }> }) {
  const { attId } = await ctx.params;
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;

  const download = req.nextUrl.searchParams.get("download") === "1";

  try {
    const att = await getDanaCashAttachmentById(attId);
    if (!att) return NextResponse.json({ error: "Lampiran tidak ditemukan." }, { status: 404 });
    if (!canAccessLocation(persona, att.locationId, att.projectId)) {
      return NextResponse.json({ error: "Tidak ada akses ke lampiran ini." }, { status: 403 });
    }
    if (!att.storageKey) {
      return NextResponse.json({ error: "File belum tersedia untuk lampiran ini." }, { status: 409 });
    }

    const previewable = isPreviewable(att.fileType);
    const previewType = classifyPreview(att.fileType);
    if (!download && !previewable) {
      return NextResponse.json(
        { error: "Tipe file tidak dapat dipratinjau.", fileType: att.fileType, previewType },
        { status: 415 },
      );
    }
    return NextResponse.json({
      source: "db",
      id: att.id,
      fileName: att.fileName,
      fileType: att.fileType,
      sizeBytes: att.sizeBytes,
      mode: download ? "download" : "preview",
      previewable,
      previewType,
      previewUrl: att.storageKey,
      downloadUrl: att.storageKey,
    });
  } catch {
    return NextResponse.json({ error: "Database tidak tersedia." }, { status: 503 });
  }
}
