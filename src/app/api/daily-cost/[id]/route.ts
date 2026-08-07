import { NextResponse, type NextRequest } from "next/server";
import {
  deleteDailyTransaction,
  getDailyTransactionById,
  getDailyTransactionWithLines,
  updateDailySubmission,
} from "@/db/repositories/daily-transaction-repository";
import { isPeriodLocked } from "@/db/repositories/lock-period-repository";
import { authorizeDashboard, requirePersona } from "@/lib/server/rbac";
import { revalidateKpi } from "@/lib/server/kpi-cache";
import { isInputClosedForDate } from "@/lib/server/services/cutoff-policy-service";
import { canAccessLocation, type Persona } from "@/lib/personas";
import { prepareDailyCostSubmission } from "@/lib/server/services/daily-cost-submission-service";

export const dynamic = "force-dynamic";

async function loadAndAuthorize(id: string, persona: Persona) {
  const existing = await getDailyTransactionById(id);
  if (!existing) return { ok: false as const, status: 404, message: "Transaksi tidak ditemukan." };
  if (existing.kind !== "cost") {
    return { ok: false as const, status: 404, message: "Bukan transaksi daily cost." };
  }
  if (!canAccessLocation(persona, existing.locationId, existing.projectId)) {
    return { ok: false as const, status: 403, message: "Tidak ada akses ke transaksi ini." };
  }
  const authz = authorizeDashboard(persona, {
    projectId: existing.projectId,
    locationId: existing.locationId,
    scope: "tenant",
  });
  if (!authz.ok) return { ok: false as const, status: authz.status, message: authz.message };
  return { ok: true as const, existing };
}

/** GET /api/daily-cost/:id — one cost entry with its line items. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  try {
    const result = await getDailyTransactionWithLines(id);
    if (!result || result.header.kind !== "cost") {
      return NextResponse.json({ error: "Transaksi tidak ditemukan." }, { status: 404 });
    }
    if (!canAccessLocation(auth.persona, result.header.locationId, result.header.projectId)) {
      return NextResponse.json({ error: "Tidak ada akses ke transaksi ini." }, { status: 403 });
    }
    return NextResponse.json({ source: "db", ...result, locked: result.header.status === "locked" });
  } catch {
    return NextResponse.json({ error: "Database tidak tersedia." }, { status: 503 });
  }
}

/** PATCH /api/daily-cost/:id — replace the cost values after validation. */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;
  if (persona.role === "viewer") {
    return NextResponse.json({ error: "Viewer tidak dapat mengubah daily cost." }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Body JSON tidak valid." }, { status: 400 });
  }

  try {
    const loaded = await loadAndAuthorize(id, persona);
    if (!loaded.ok) return NextResponse.json({ error: loaded.message }, { status: loaded.status });
    const existing = loaded.existing;

    const trxDate = typeof body.trxDate === "string" ? body.trxDate : existing.trxDate;
    const area = typeof body.area === "string" ? body.area : (existing.area ?? undefined);
    const values =
      body.values && typeof body.values === "object" ? (body.values as Record<string, number>) : {};

    const prepared = prepareDailyCostSubmission({
      projectId: existing.projectId,
      locationId: existing.locationId,
      trxDate,
      area,
      values,
      submittedBy: persona.name,
    });
    if (!prepared.ok) {
      return NextResponse.json({ error: "Validasi gagal.", errors: prepared.errors }, { status: 422 });
    }
    if (await isPeriodLocked(existing.projectId, existing.locationId, trxDate)) {
      return NextResponse.json({ error: "Periode terkunci — entri tidak dapat diubah." }, { status: 409 });
    }
    if (isInputClosedForDate(existing.projectId, trxDate)) {
      return NextResponse.json(
        { error: "Periode sudah melewati cut-off — entri tidak dapat diubah." },
        { status: 409 },
      );
    }

    const updated = await updateDailySubmission(id, prepared.input);
    if (!updated) {
      return NextResponse.json({ error: "Transaksi terkunci atau tidak ditemukan." }, { status: 409 });
    }
    revalidateKpi();
    return NextResponse.json({ source: "db", entry: updated });
  } catch {
    return NextResponse.json({ error: "Database tidak tersedia." }, { status: 503 });
  }
}

/** DELETE /api/daily-cost/:id — remove a cost entry (lines cascade). */
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;
  if (persona.role === "viewer") {
    return NextResponse.json({ error: "Viewer tidak dapat menghapus daily cost." }, { status: 403 });
  }

  try {
    const loaded = await loadAndAuthorize(id, persona);
    if (!loaded.ok) return NextResponse.json({ error: loaded.message }, { status: loaded.status });
    if (loaded.existing.status === "locked") {
      return NextResponse.json({ error: "Transaksi terkunci tidak dapat dihapus." }, { status: 409 });
    }
    const removed = await deleteDailyTransaction(id);
    revalidateKpi();
    return NextResponse.json({ source: "db", deleted: removed });
  } catch {
    return NextResponse.json({ error: "Database tidak tersedia." }, { status: 503 });
  }
}
