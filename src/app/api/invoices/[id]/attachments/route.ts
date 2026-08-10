import { NextResponse, type NextRequest } from "next/server";
import { getInvoiceById } from "@/db/repositories/invoice-repository";
import { addAttachment, listAttachments } from "@/db/repositories/invoice-attachment-repository";
import type { NewInvoiceAttachment } from "@/db/schema";
import { requirePersona } from "@/lib/server/rbac";
import { isAllowedUpload } from "@/lib/server/file-types";
import { canAccessLocation, type Persona } from "@/lib/personas";

export const dynamic = "force-dynamic";

/** Max attachment size accepted (bytes) — 10 MB. */
const MAX_SIZE = 10 * 1024 * 1024;

async function loadInvoice(id: string, persona: Persona) {
  const invoice = await getInvoiceById(id);
  if (!invoice) return { ok: false as const, status: 404, message: "Invoice tidak ditemukan." };
  if (!canAccessLocation(persona, invoice.locationId, invoice.projectId)) {
    return { ok: false as const, status: 403, message: "Tidak ada akses ke invoice ini." };
  }
  return { ok: true as const, invoice };
}

/**
 * GET /api/invoices/:id/attachments
 * Lists an invoice's attachments (metadata + storage key) for preview.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  try {
    const loaded = await loadInvoice(id, auth.persona);
    if (!loaded.ok) return NextResponse.json({ error: loaded.message }, { status: loaded.status });
    const attachments = await listAttachments(id);
    return NextResponse.json({ source: "db", invoiceId: id, count: attachments.length, attachments });
  } catch {
    return NextResponse.json({ error: "Database tidak tersedia." }, { status: 503 });
  }
}

/**
 * POST /api/invoices/:id/attachments
 * Body: { fileName, fileType?, sizeBytes?, category?, stage?, note?, storageKey? }
 * Registers an uploaded attachment's metadata against the invoice. Viewers
 * cannot upload; the persona must have access to the invoice's site.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;
  if (persona.role === "viewer") {
    return NextResponse.json({ error: "Viewer tidak dapat mengunggah lampiran." }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Body JSON tidak valid." }, { status: 400 });
  }

  const fileName = typeof body.fileName === "string" ? body.fileName : "";
  if (!fileName) {
    return NextResponse.json({ error: "fileName wajib diisi." }, { status: 400 });
  }
  const sizeBytes = Number.isFinite(Number(body.sizeBytes)) ? Number(body.sizeBytes) : 0;
  if (sizeBytes > MAX_SIZE) {
    return NextResponse.json({ error: "Ukuran lampiran melebihi 10 MB." }, { status: 413 });
  }
  const fileType = typeof body.fileType === "string" ? body.fileType : undefined;
  if (!isAllowedUpload(fileType)) {
    return NextResponse.json({ error: `Tipe file tidak didukung: ${fileType}.` }, { status: 415 });
  }

  try {
    const loaded = await loadInvoice(id, persona);
    if (!loaded.ok) return NextResponse.json({ error: loaded.message }, { status: loaded.status });
    const invoice = loaded.invoice;

    const values: NewInvoiceAttachment = {
      invoiceId: invoice.id,
      projectId: invoice.projectId,
      locationId: invoice.locationId,
      category: typeof body.category === "string" ? body.category : undefined,
      stage: typeof body.stage === "string" ? body.stage : undefined,
      fileName,
      fileType: typeof body.fileType === "string" ? body.fileType : undefined,
      sizeBytes,
      note: typeof body.note === "string" ? body.note : undefined,
      storageKey: typeof body.storageKey === "string" ? body.storageKey : undefined,
      uploadedBy: persona.name,
    };
    const attachment = await addAttachment(values);
    return NextResponse.json({ source: "db", attachment }, { status: 201 });
  } catch (err) {
    return NextResponse.json({
      source: "mock",
      simulated: true,
      message: "Lampiran dicatat secara simulasi (database tidak tersedia).",
      detail: err instanceof Error ? err.message : String(err),
      attachment: { invoiceId: id, fileName, sizeBytes },
    });
  }
}
