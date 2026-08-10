import { NextResponse, type NextRequest } from "next/server";
import { getInvoiceById } from "@/db/repositories/invoice-repository";
import { addAttachment } from "@/db/repositories/invoice-attachment-repository";
import type { NewInvoiceAttachment } from "@/db/schema";
import { requirePersona } from "@/lib/server/rbac";
import { isAllowedUpload } from "@/lib/server/file-types";
import { recordDocumentUpload } from "@/lib/server/services/invoice-audit-service";
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

/** Sanitize a file name to a safe basename (no path separators, bounded length). */
function safeFileName(name: string): string {
  const base = name.replace(/[/\\]/g, "_").replace(/[^\w.\- ]/g, "").trim();
  return (base || "dokumen").slice(0, 200);
}

/**
 * POST /api/invoices/:id/attachments/upload
 * Multipart/form-data body: file (required), plus optional category, stage, note.
 *
 * Receives the actual document, validates its type and size, then registers it
 * against the invoice. Storage is key-based (the binary is not held in the DB):
 * the endpoint derives a deterministic storage key from the invoice + a
 * timestamp and the sanitized file name. Viewers cannot upload; the persona must
 * have access to the invoice's site.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;
  if (persona.role === "viewer") {
    return NextResponse.json({ error: "Viewer tidak dapat mengunggah dokumen." }, { status: 403 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Body harus multipart/form-data dengan field 'file'." },
      { status: 400 },
    );
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Field 'file' wajib diisi." }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "File kosong." }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "Ukuran dokumen melebihi 10 MB." }, { status: 413 });
  }
  const fileType = file.type || undefined;
  if (!isAllowedUpload(fileType)) {
    return NextResponse.json({ error: `Tipe file tidak didukung: ${fileType ?? "?"}.` }, { status: 415 });
  }

  const fileName = safeFileName(file.name);
  const category = typeof form.get("category") === "string" ? (form.get("category") as string) : undefined;
  const stage = typeof form.get("stage") === "string" ? (form.get("stage") as string) : undefined;
  const note = typeof form.get("note") === "string" ? (form.get("note") as string) : undefined;

  try {
    const loaded = await loadInvoice(id, persona);
    if (!loaded.ok) return NextResponse.json({ error: loaded.message }, { status: loaded.status });
    const invoice = loaded.invoice;

    // Derive a key-based storage reference (binary is not persisted in the DB).
    const storageKey = `invoices/${invoice.id}/${Date.now()}-${fileName}`;

    const values: NewInvoiceAttachment = {
      invoiceId: invoice.id,
      projectId: invoice.projectId,
      locationId: invoice.locationId,
      category,
      stage,
      fileName,
      fileType,
      sizeBytes: file.size,
      note,
      storageKey,
      uploadedBy: persona.name,
    };
    const attachment = await addAttachment(values);
    try {
      await recordDocumentUpload(invoice, persona.name, fileName, persona.role);
    } catch {
      /* audit logging is best-effort */
    }
    return NextResponse.json({ source: "db", attachment }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      {
        source: "mock",
        simulated: true,
        message: "Dokumen diterima secara simulasi (database tidak tersedia).",
        detail: err instanceof Error ? err.message : String(err),
        file: { fileName, fileType, sizeBytes: file.size, category, stage, note },
      },
      { status: 202 },
    );
  }
}
