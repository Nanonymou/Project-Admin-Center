import { NextResponse, type NextRequest } from "next/server";
import { getDailyTransactionById } from "@/db/repositories/daily-transaction-repository";
import {
  addTransactionAttachment,
  listTransactionAttachments,
} from "@/db/repositories/transaction-attachment-repository";
import type { NewTransactionAttachment } from "@/db/schema";
import { requirePersona } from "@/lib/server/rbac";
import { canAccessLocation, type Persona } from "@/lib/personas";

export const dynamic = "force-dynamic";

const MAX_SIZE = 10 * 1024 * 1024;

async function loadTransaction(id: string, persona: Persona) {
  const tx = await getDailyTransactionById(id);
  if (!tx) return { ok: false as const, status: 404, message: "Transaksi tidak ditemukan." };
  if (!canAccessLocation(persona, tx.locationId, tx.projectId)) {
    return { ok: false as const, status: 403, message: "Tidak ada akses ke transaksi ini." };
  }
  return { ok: true as const, tx };
}

/**
 * GET /api/daily-cost/:id/attachments — list a cost entry's attachments.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  try {
    const loaded = await loadTransaction(id, auth.persona);
    if (!loaded.ok) return NextResponse.json({ error: loaded.message }, { status: loaded.status });
    const attachments = await listTransactionAttachments(id);
    return NextResponse.json({ source: "db", transactionId: id, count: attachments.length, attachments });
  } catch {
    return NextResponse.json({ error: "Database tidak tersedia." }, { status: 503 });
  }
}

/**
 * POST /api/daily-cost/:id/attachments
 * Body: { fileName, fileType?, sizeBytes?, category?, storageKey? }
 * Registers uploaded cost-proof metadata against the daily transaction. Viewers
 * cannot upload; the persona must have access to the transaction's site.
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
  if (!fileName) return NextResponse.json({ error: "fileName wajib diisi." }, { status: 400 });
  const sizeBytes = Number.isFinite(Number(body.sizeBytes)) ? Number(body.sizeBytes) : 0;
  if (sizeBytes > MAX_SIZE) {
    return NextResponse.json({ error: "Ukuran lampiran melebihi 10 MB." }, { status: 413 });
  }

  try {
    const loaded = await loadTransaction(id, persona);
    if (!loaded.ok) return NextResponse.json({ error: loaded.message }, { status: loaded.status });
    const tx = loaded.tx;

    const values: NewTransactionAttachment = {
      transactionId: tx.id,
      projectId: tx.projectId,
      locationId: tx.locationId,
      category: typeof body.category === "string" ? body.category : undefined,
      fileName,
      fileType: typeof body.fileType === "string" ? body.fileType : undefined,
      sizeBytes,
      storageKey: typeof body.storageKey === "string" ? body.storageKey : undefined,
      uploadedBy: persona.name,
    };
    const attachment = await addTransactionAttachment(values);
    return NextResponse.json({ source: "db", attachment }, { status: 201 });
  } catch (err) {
    return NextResponse.json({
      source: "mock",
      simulated: true,
      message: "Lampiran dicatat secara simulasi (database tidak tersedia).",
      detail: err instanceof Error ? err.message : String(err),
      attachment: { transactionId: id, fileName, sizeBytes },
    });
  }
}
