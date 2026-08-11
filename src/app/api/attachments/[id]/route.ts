import { NextResponse, type NextRequest } from "next/server";
import { getAttachmentFromView } from "@/db/repositories/attachment-center-repository";
import { requirePersona } from "@/lib/server/rbac";
import { classifyPreview, isPreviewable } from "@/lib/server/file-types";
import { canAccessLocation } from "@/lib/personas";

export const dynamic = "force-dynamic";

/**
 * GET /api/attachments/:id — unified metadata for a single attachment (any
 * source: invoice, transaction, evidence, dana_cash), resolved from the
 * all_attachments view. Enforces that the persona may access the attachment's
 * site. Includes the preview classification so the Pratinjau Lampiran screen can
 * decide how to render it without a second call.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;

  try {
    const row = await getAttachmentFromView(id);
    if (!row) return NextResponse.json({ error: "Lampiran tidak ditemukan." }, { status: 404 });
    if (row.projectId && !canAccessLocation(persona, row.locationId ?? "", row.projectId)) {
      return NextResponse.json({ error: "Tidak ada akses ke lampiran ini." }, { status: 403 });
    }
    const previewType = classifyPreview(row.fileType);
    const previewable = isPreviewable(row.fileType);
    return NextResponse.json({
      source: "db",
      attachment: {
        ...row,
        previewable,
        previewType,
        hasFile: Boolean(row.storageKey),
      },
    });
  } catch {
    return NextResponse.json({ error: "Database tidak tersedia." }, { status: 503 });
  }
}
