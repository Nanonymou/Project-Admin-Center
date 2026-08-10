import { NextResponse, type NextRequest } from "next/server";
import { getDanaCashTransactionById } from "@/db/repositories/dana-cash-repository";
import {
  listDanaCashAttachments,
  createDanaCashAttachment,
} from "@/db/repositories/dana-cash-attachment-repository";
import type { NewDanaCashAttachment } from "@/db/schema";
import { requirePersona } from "@/lib/server/rbac";
import { canAccessLocation } from "@/lib/personas";
import { classifyPreview, isPreviewable, isAllowedUpload } from "@/lib/server/file-types";

export const dynamic = "force-dynamic";

const MAX_SIZE_BYTES = 5 * 1024 * 1024;

/**
 * GET /api/dana-cash/:id/attachments
 * Lists a Dana Cash transaction's evidence attachments with preview
 * classification, enforcing site access.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;

  try {
    const trx = await getDanaCashTransactionById(id);
    if (!trx) return NextResponse.json({ error: "Transaksi tidak ditemukan." }, { status: 404 });
    if (!canAccessLocation(persona, trx.locationId, trx.projectId)) {
      return NextResponse.json({ error: "Tidak ada akses ke transaksi ini." }, { status: 403 });
    }
    const rows = await listDanaCashAttachments(id);
    return NextResponse.json({
      source: "db",
      count: rows.length,
      attachments: rows.map((a) => ({
        ...a,
        previewable: isPreviewable(a.fileType),
        previewType: classifyPreview(a.fileType),
        previewUrl: a.storageKey,
      })),
    });
  } catch {
    return NextResponse.json({ source: "mock", count: 0, attachments: [] });
  }
}

/**
 * POST /api/dana-cash/:id/attachments
 * Body: { fileName, fileType?, sizeBytes?, storageKey? }
 * Records an uploaded receipt for a Dana Cash transaction (metadata only; the
 * binary goes to storage). Validates type/size and enforces site access.
 * Returns the attachment plus preview classification.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;
  if (persona.role === "viewer") {
    return NextResponse.json({ error: "Viewer tidak dapat mengunggah bukti." }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Body JSON tidak valid." }, { status: 400 });
  }

  const fileName = typeof body.fileName === "string" ? body.fileName.trim() : "";
  const fileType = typeof body.fileType === "string" ? body.fileType : undefined;
  const sizeBytes = Number(body.sizeBytes) || 0;
  if (!fileName) {
    return NextResponse.json({ error: "fileName wajib diisi." }, { status: 400 });
  }
  if (!isAllowedUpload(fileType)) {
    return NextResponse.json({ error: "Tipe berkas tidak didukung (JPG, PNG, PDF)." }, { status: 422 });
  }
  if (sizeBytes > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "Ukuran berkas melebihi batas 5 MB." }, { status: 422 });
  }

  try {
    const trx = await getDanaCashTransactionById(id);
    if (!trx) return NextResponse.json({ error: "Transaksi tidak ditemukan." }, { status: 404 });
    if (!canAccessLocation(persona, trx.locationId, trx.projectId)) {
      return NextResponse.json({ error: "Tidak ada akses ke transaksi ini." }, { status: 403 });
    }

    const values: NewDanaCashAttachment = {
      transactionId: id,
      projectId: trx.projectId,
      locationId: trx.locationId,
      fileName,
      fileType: fileType ?? null,
      sizeBytes,
      storageKey: typeof body.storageKey === "string" ? body.storageKey : null,
      uploadedBy: persona.name,
    };
    const row = await createDanaCashAttachment(values);
    return NextResponse.json(
      {
        source: "db",
        attachment: { ...row, previewable: isPreviewable(row.fileType), previewType: classifyPreview(row.fileType) },
      },
      { status: 201 },
    );
  } catch {
    return NextResponse.json({ error: "Database tidak tersedia." }, { status: 503 });
  }
}
