import { NextResponse, type NextRequest } from "next/server";
import {
  listEvidence,
  createEvidence,
  type EvidenceFilter,
} from "@/db/repositories/evidence-attachment-repository";
import type { NewEvidenceAttachment } from "@/db/schema";
import { writeAuditLog } from "@/db/repositories/audit-log-repository";
import { requirePersona } from "@/lib/server/rbac";
import { canAccessLocation } from "@/lib/personas";
import { isAllowedUpload } from "@/lib/server/file-types";

export const dynamic = "force-dynamic";

const KINDS = ["payment", "invoice", "delivery", "receipt", "cost"];
const MAX_SIZE_BYTES = 5 * 1024 * 1024;

/**
 * GET /api/evidence?projectId=&locationId=&kind=&status=&scope=
 * Lists evidence attachments for the Upload Bukti center, scoped to the persona.
 * Falls back to an empty list when the database is unavailable.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const projectId = sp.get("projectId") ?? undefined;
  const scope = (sp.get("scope") as "tenant" | "executive" | null) ?? (projectId ? "tenant" : "executive");
  const statusRaw = sp.get("status");
  const status =
    statusRaw === "pending" || statusRaw === "verified" || statusRaw === "rejected" ? statusRaw : undefined;
  const filter: EvidenceFilter = {
    projectId,
    locationId: sp.get("locationId") ?? undefined,
    kind: sp.get("kind") ?? undefined,
    status,
    scope,
  };

  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;

  try {
    const rows = (await listEvidence(filter)).filter((r) =>
      canAccessLocation(persona, r.locationId, r.projectId),
    );
    return NextResponse.json({ source: "db", count: rows.length, evidence: rows });
  } catch {
    return NextResponse.json({ source: "mock", count: 0, evidence: [] });
  }
}

/**
 * POST /api/evidence
 * Body: { projectId, locationId, kind, fileName, fileType?, sizeBytes?, reference?, storageKey? }
 *
 * Records an uploaded evidence attachment (metadata only; the binary is uploaded
 * to storage separately and referenced by `storageKey`). Validates the file type
 * and size, enforces tenant access, and starts the row in `pending` review.
 */
export async function POST(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Body JSON tidak valid." }, { status: 400 });
  }

  const projectId = typeof body.projectId === "string" ? body.projectId : "";
  const locationId = typeof body.locationId === "string" ? body.locationId : "";
  const kind = typeof body.kind === "string" ? body.kind : "";
  const fileName = typeof body.fileName === "string" ? body.fileName.trim() : "";
  const fileType = typeof body.fileType === "string" ? body.fileType : undefined;
  const sizeBytes = Number(body.sizeBytes) || 0;

  if (!projectId || !locationId || !fileName) {
    return NextResponse.json(
      { error: "projectId, locationId, dan fileName wajib diisi." },
      { status: 400 },
    );
  }
  if (!KINDS.includes(kind)) {
    return NextResponse.json({ error: `kind harus salah satu: ${KINDS.join(", ")}.` }, { status: 400 });
  }
  if (!canAccessLocation(persona, locationId, projectId)) {
    return NextResponse.json({ error: `Tidak ada akses ke lokasi ${locationId}.` }, { status: 403 });
  }
  if (!isAllowedUpload(fileType)) {
    return NextResponse.json({ error: "Tipe berkas tidak didukung (JPG, PNG, PDF)." }, { status: 422 });
  }
  if (sizeBytes > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "Ukuran berkas melebihi batas 5 MB." }, { status: 422 });
  }

  const values: NewEvidenceAttachment = {
    projectId,
    locationId,
    kind,
    fileName,
    fileType: fileType ?? null,
    sizeBytes,
    storageKey: typeof body.storageKey === "string" ? body.storageKey : null,
    status: "pending",
    reference: typeof body.reference === "string" ? body.reference : null,
    uploadedBy: persona.name,
    createdBy: persona.name,
  };

  try {
    const row = await createEvidence(values);
    // Activity log: record the upload for the site's audit trail.
    try {
      await writeAuditLog({
        projectId,
        locationId,
        category: "evidence",
        action: "upload",
        actor: persona.name,
        entityType: "evidence_attachment",
        entityId: row.id,
        detail: `Unggah bukti ${kind}: ${fileName}`,
      });
    } catch {
      // audit trail is best-effort; never fail the upload on log error
    }
    return NextResponse.json({ source: "db", evidence: row }, { status: 201 });
  } catch {
    return NextResponse.json(
      { source: "mock", evidence: { ...values, id: `mock-${Date.now()}`, uploadedAt: new Date().toISOString() } },
      { status: 201 },
    );
  }
}
