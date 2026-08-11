import { NextResponse, type NextRequest } from "next/server";
import { getInvoiceById } from "@/db/repositories/invoice-repository";
import { addAttachment } from "@/db/repositories/invoice-attachment-repository";
import {
  listStageProgressForInvoice,
  upsertStageProgress,
} from "@/db/repositories/invoice-stage-progress-repository";
import type { NewInvoiceAttachment, NewInvoiceStageProgress } from "@/db/schema";
import { recordDocumentUpload } from "@/lib/server/services/invoice-audit-service";
import { resolveTimeframes } from "@/lib/server/services/master-timeframe-service";
import { requirePersona } from "@/lib/server/rbac";
import { isAllowedUpload } from "@/lib/server/file-types";
import { canAccessLocation } from "@/lib/personas";

export const dynamic = "force-dynamic";

/** Max attachment size accepted (bytes) — 10 MB. */
const MAX_SIZE = 10 * 1024 * 1024;

/** Sanitize a file name to a safe basename (no path separators, bounded length). */
function safeFileName(name: string): string {
  const base = name.replace(/[/\\]/g, "_").replace(/[^\w.\- ]/g, "").trim();
  return (base || "dokumen").slice(0, 200);
}

/**
 * POST /api/invoices/:id/timeline/documents
 * Multipart/form-data body: file (required), stage (required), note (optional).
 *
 * Uploads a supporting document for a specific timeline stage: it registers the
 * attachment tagged with the stage, then increments that stage's doc_count on the
 * processing timeline so the stage node reflects how many documents back it.
 * Storage is key-based (binary not held in the DB). Viewers cannot upload; the
 * persona must have access to the invoice's site.
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
      { error: "Body harus multipart/form-data dengan field 'file' dan 'stage'." },
      { status: 400 },
    );
  }

  const file = form.get("file");
  const stage = typeof form.get("stage") === "string" ? (form.get("stage") as string) : "";
  const note = typeof form.get("note") === "string" ? (form.get("note") as string) : undefined;
  if (!stage) return NextResponse.json({ error: "Field 'stage' wajib diisi." }, { status: 400 });
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Field 'file' wajib diisi." }, { status: 400 });
  }
  if (file.size === 0) return NextResponse.json({ error: "File kosong." }, { status: 400 });
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "Ukuran dokumen melebihi 10 MB." }, { status: 413 });
  }
  const fileType = file.type || undefined;
  if (!isAllowedUpload(fileType)) {
    return NextResponse.json({ error: `Tipe file tidak didukung: ${fileType ?? "?"}.` }, { status: 415 });
  }
  const fileName = safeFileName(file.name);

  try {
    const invoice = await getInvoiceById(id);
    if (!invoice) return NextResponse.json({ error: "Invoice tidak ditemukan." }, { status: 404 });
    if (!canAccessLocation(persona, invoice.locationId, invoice.projectId)) {
      return NextResponse.json({ error: "Tidak ada akses ke invoice ini." }, { status: 403 });
    }

    // The stage must be part of the invoice's Master-Timeframe-resolved flow.
    const flow = await resolveTimeframes(invoice.projectId, "invoice");
    const flowIdx = flow.findIndex((f) => f.stage === stage);
    if (flowIdx === -1) {
      return NextResponse.json({ error: `Stage tidak dikenal: ${stage}.` }, { status: 400 });
    }

    // Register the attachment tagged with the stage.
    const storageKey = `invoices/${invoice.id}/${stage}/${Date.now()}-${fileName}`;
    const attachmentValues: NewInvoiceAttachment = {
      invoiceId: invoice.id,
      projectId: invoice.projectId,
      locationId: invoice.locationId,
      category: "timeline",
      stage,
      fileName,
      fileType,
      sizeBytes: file.size,
      note,
      storageKey,
      uploadedBy: persona.name,
    };
    const attachment = await addAttachment(attachmentValues);

    // Bump the stage's doc_count, preserving the row's other fields (or seeding a
    // new row from config when the stage has no progress yet).
    const existing = (await listStageProgressForInvoice(id)).find((r) => r.stage === stage);
    const stageValues: NewInvoiceStageProgress = {
      invoiceId: invoice.id,
      projectId: invoice.projectId,
      locationId: invoice.locationId,
      stage,
      stageOrder: existing?.stageOrder ?? flow[flowIdx].order,
      slaDays: existing?.slaDays ?? flow[flowIdx].slaDays,
      state: existing?.state ?? "current",
      startedAt: existing?.startedAt ?? null,
      completedAt: existing?.completedAt ?? null,
      actualDays: existing?.actualDays ?? 0,
      breached: existing?.breached ?? false,
      pic: existing?.pic ?? invoice.pic ?? undefined,
      docCount: (existing?.docCount ?? 0) + 1,
      createdBy: persona.name,
    };
    const stageRow = await upsertStageProgress(stageValues);

    try {
      await recordDocumentUpload(invoice, persona.name, fileName, persona.role);
    } catch {
      /* audit logging is best-effort */
    }

    return NextResponse.json({ source: "db", attachment, stage: stageRow }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      {
        source: "mock",
        simulated: true,
        message: "Dokumen aktivitas diterima secara simulasi (database tidak tersedia).",
        detail: err instanceof Error ? err.message : String(err),
        file: { fileName, fileType, sizeBytes: file.size, stage, note },
      },
      { status: 202 },
    );
  }
}
