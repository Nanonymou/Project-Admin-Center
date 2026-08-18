import { NextResponse, type NextRequest } from "next/server";
import { put } from "@vercel/blob";
import { createEvidence } from "@/db/repositories/evidence-attachment-repository";
import type { NewEvidenceAttachment } from "@/db/schema";
import { writeAuditLog } from "@/db/repositories/audit-log-repository";
import { requirePersona } from "@/lib/server/rbac";
import { canAccessLocation } from "@/lib/personas";
import { isAllowedUpload } from "@/lib/server/file-types";

export const dynamic = "force-dynamic";

const KINDS = ["payment", "invoice", "delivery", "receipt", "cost"];
const MAX_SIZE_BYTES = 5 * 1024 * 1024;

/** Sanitize a file name to a safe basename (no path separators, bounded length). */
function safeFileName(name: string): string {
  const base = name.replace(/[/\\]/g, "_").replace(/[^\w.\- ]/g, "").trim();
  return (base || "bukti").slice(0, 200);
}

/**
 * POST /api/evidence/upload
 * Multipart/form-data body: file (required), projectId, locationId, kind, reference?
 *
 * Receives the actual evidence file, validates type/size, uploads the binary to
 * blob storage when configured (Vercel Blob via BLOB_READ_WRITE_TOKEN) — otherwise
 * falls back to the app's key-based reference convention (metadata only) — then
 * records the attachment metadata in `pending` review. Viewers cannot upload; the
 * persona must have access to the site.
 */
export async function POST(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;
  if (persona.role === "viewer") {
    return NextResponse.json({ error: "Viewer tidak dapat mengunggah bukti." }, { status: 403 });
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
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "Ukuran berkas melebihi batas 5 MB." }, { status: 413 });
  }
  const fileType = file.type || undefined;
  if (!isAllowedUpload(fileType)) {
    return NextResponse.json({ error: "Tipe berkas tidak didukung (JPG, PNG, PDF)." }, { status: 415 });
  }

  const projectId = typeof form.get("projectId") === "string" ? (form.get("projectId") as string) : "";
  const locationId = typeof form.get("locationId") === "string" ? (form.get("locationId") as string) : "";
  const kind = typeof form.get("kind") === "string" ? (form.get("kind") as string) : "";
  const reference = typeof form.get("reference") === "string" ? (form.get("reference") as string) : null;

  if (!projectId || !locationId) {
    return NextResponse.json({ error: "projectId dan locationId wajib diisi." }, { status: 400 });
  }
  if (!KINDS.includes(kind)) {
    return NextResponse.json({ error: `kind harus salah satu: ${KINDS.join(", ")}.` }, { status: 400 });
  }
  if (!canAccessLocation(persona, locationId, projectId)) {
    return NextResponse.json({ error: `Tidak ada akses ke lokasi ${locationId}.` }, { status: 403 });
  }

  const fileName = safeFileName(file.name);
  // Store the binary in Vercel Blob when a token is configured; otherwise keep the
  // app's key-based convention (metadata only, no bytes persisted).
  let storageKey = `evidence/${locationId}/${Date.now()}-${fileName}`;
  let stored: "blob" | "metadata" = "metadata";
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const blob = await put(storageKey, file, { access: "public", addRandomSuffix: true });
      storageKey = blob.url;
      stored = "blob";
    } catch {
      // Blob upload failed — fall back to the metadata-only key reference.
    }
  }

  const values: NewEvidenceAttachment = {
    projectId,
    locationId,
    kind,
    fileName,
    fileType: fileType ?? null,
    sizeBytes: file.size,
    storageKey,
    status: "pending",
    reference,
    uploadedBy: persona.name,
    createdBy: persona.name,
  };

  try {
    const row = await createEvidence(values);
    try {
      await writeAuditLog({
        projectId,
        locationId,
        category: "evidence",
        action: "upload",
        actor: persona.name,
        entityType: "evidence_attachment",
        entityId: row.id,
        detail: `Unggah bukti ${kind}: ${fileName}${stored === "blob" ? " (file tersimpan)" : ""}`,
      });
    } catch {
      // audit trail is best-effort; never fail the upload on log error
    }
    return NextResponse.json({ source: "db", evidence: row, stored }, { status: 201 });
  } catch {
    return NextResponse.json(
      {
        source: "mock",
        stored,
        evidence: { ...values, id: `mock-${Date.now()}`, uploadedAt: new Date().toISOString() },
      },
      { status: 201 },
    );
  }
}
