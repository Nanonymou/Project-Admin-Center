import { NextResponse, type NextRequest } from "next/server";
import {
  getEvidenceById,
  setEvidenceStatus,
  softDeleteEvidence,
} from "@/db/repositories/evidence-attachment-repository";
import { requirePersona } from "@/lib/server/rbac";
import { canAccessLocation } from "@/lib/personas";
import { classifyPreview, isPreviewable } from "@/lib/server/file-types";

export const dynamic = "force-dynamic";

/**
 * GET /api/evidence/:id
 * Returns one evidence attachment's metadata plus preview classification,
 * enforcing that the persona may access its site.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;

  try {
    const row = await getEvidenceById(id);
    if (!row) return NextResponse.json({ error: "Lampiran tidak ditemukan." }, { status: 404 });
    if (!canAccessLocation(persona, row.locationId, row.projectId)) {
      return NextResponse.json({ error: "Tidak ada akses ke lampiran ini." }, { status: 403 });
    }
    return NextResponse.json({
      source: "db",
      evidence: row,
      previewable: isPreviewable(row.fileType),
      previewType: classifyPreview(row.fileType),
    });
  } catch {
    return NextResponse.json({ error: "Database tidak tersedia." }, { status: 503 });
  }
}

/**
 * PATCH /api/evidence/:id  Body: { status, note? }
 * Reviews an evidence attachment (verify / reject). Restricted to approve-capable
 * personas with access to the attachment's site.
 */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;
  if (!persona.capabilities.canApprove) {
    return NextResponse.json({ error: "Tidak memiliki hak verifikasi bukti." }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Body JSON tidak valid." }, { status: 400 });
  }
  const status = body.status;
  if (status !== "pending" && status !== "verified" && status !== "rejected") {
    return NextResponse.json({ error: "status harus pending|verified|rejected." }, { status: 400 });
  }
  const note = typeof body.note === "string" ? body.note : undefined;

  try {
    const existing = await getEvidenceById(id);
    if (!existing) return NextResponse.json({ error: "Lampiran tidak ditemukan." }, { status: 404 });
    if (!canAccessLocation(persona, existing.locationId, existing.projectId)) {
      return NextResponse.json({ error: "Tidak ada akses ke lampiran ini." }, { status: 403 });
    }
    const row = await setEvidenceStatus(id, existing.projectId, status, persona.name, note);
    return NextResponse.json({ source: "db", evidence: row });
  } catch {
    return NextResponse.json({ error: "Database tidak tersedia." }, { status: 503 });
  }
}

/**
 * DELETE /api/evidence/:id
 * Soft-deletes an evidence attachment (moves it to the recycle bin). Restricted
 * to configure-capable personas with access to the attachment's site.
 */
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;
  if (!persona.capabilities.canConfigure) {
    return NextResponse.json({ error: "Tidak memiliki hak menghapus bukti." }, { status: 403 });
  }

  try {
    const existing = await getEvidenceById(id);
    if (!existing) return NextResponse.json({ error: "Lampiran tidak ditemukan." }, { status: 404 });
    if (!canAccessLocation(persona, existing.locationId, existing.projectId)) {
      return NextResponse.json({ error: "Tidak ada akses ke lampiran ini." }, { status: 403 });
    }
    const ok = await softDeleteEvidence(id, existing.projectId, persona.name);
    return NextResponse.json({ source: "db", deleted: ok });
  } catch {
    return NextResponse.json({ error: "Database tidak tersedia." }, { status: 503 });
  }
}
