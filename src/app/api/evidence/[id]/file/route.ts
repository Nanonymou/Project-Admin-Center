import { NextResponse, type NextRequest } from "next/server";
import { getEvidenceById } from "@/db/repositories/evidence-attachment-repository";
import { requirePersona } from "@/lib/server/rbac";
import { canAccessLocation } from "@/lib/personas";
import { classifyPreview, isPreviewable } from "@/lib/server/file-types";

export const dynamic = "force-dynamic";

/**
 * GET /api/evidence/:id/file?download=1
 * Resolves an evidence attachment's file reference for preview or download,
 * enforcing that the persona may access its site. Storage is key-based (no binary
 * held in the DB), so the response returns the resolved storage key as
 * preview/download URLs plus the file metadata.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;

  const download = req.nextUrl.searchParams.get("download") === "1";

  try {
    const row = await getEvidenceById(id);
    if (!row) return NextResponse.json({ error: "Lampiran tidak ditemukan." }, { status: 404 });
    if (!canAccessLocation(persona, row.locationId, row.projectId)) {
      return NextResponse.json({ error: "Tidak ada akses ke lampiran ini." }, { status: 403 });
    }
    if (!row.storageKey) {
      return NextResponse.json({ error: "File belum tersedia untuk lampiran ini." }, { status: 409 });
    }

    const previewable = isPreviewable(row.fileType);
    const previewType = classifyPreview(row.fileType);
    if (!download && !previewable) {
      return NextResponse.json(
        { error: "Tipe file tidak dapat dipratinjau.", fileType: row.fileType, previewType },
        { status: 415 },
      );
    }
    return NextResponse.json({
      source: "db",
      id: row.id,
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
