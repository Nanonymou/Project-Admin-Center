import { NextResponse, type NextRequest } from "next/server";
import { getAttachmentFromView } from "@/db/repositories/attachment-center-repository";
import { requirePersona } from "@/lib/server/rbac";
import { classifyPreview, isPreviewable } from "@/lib/server/file-types";
import { canAccessLocation } from "@/lib/personas";

export const dynamic = "force-dynamic";

/**
 * GET /api/attachments/:id/file?download=1
 * Resolves an attachment's file for preview or download from the unified
 * all_attachments view, so every source (invoice, transaction, evidence,
 * dana_cash) is served by one endpoint. Storage is key-based (no binary held in
 * the DB): the response returns the resolved storage key as preview/download
 * URLs plus the file metadata. `download=1` marks the intent as a download and
 * bypasses the previewable-type check. Enforces that the persona may access the
 * attachment's site.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;

  const download = req.nextUrl.searchParams.get("download") === "1";

  try {
    const row = await getAttachmentFromView(id);
    if (!row) return NextResponse.json({ error: "Lampiran tidak ditemukan." }, { status: 404 });
    if (row.projectId && !canAccessLocation(persona, row.locationId ?? "", row.projectId)) {
      return NextResponse.json({ error: "Tidak ada akses ke lampiran ini." }, { status: 403 });
    }
    if (!row.storageKey) {
      return NextResponse.json({ error: "File belum tersedia untuk lampiran ini." }, { status: 409 });
    }

    const previewType = classifyPreview(row.fileType);
    const previewable = isPreviewable(row.fileType);
    // A preview request for a non-previewable type is rejected; download is fine.
    if (!download && !previewable) {
      return NextResponse.json(
        { error: "Tipe file tidak dapat dipratinjau.", fileType: row.fileType, previewType },
        { status: 415 },
      );
    }
    return NextResponse.json({
      source: row.source,
      id: row.id,
      entityId: row.entityId,
      fileName: row.fileName,
      fileType: row.fileType,
      sizeBytes: row.sizeBytes,
      mode: download ? "download" : "preview",
      previewable,
      previewType,
      previewUrl: row.storageKey,
      downloadUrl: row.storageKey,
    });
  } catch {
    return NextResponse.json({ error: "Database tidak tersedia." }, { status: 503 });
  }
}
