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
import { canAccessLocation, type Persona } from "@/lib/personas";
import { prepareDailySalesSubmission } from "@/lib/server/services/daily-sales-submission-service";
import type { SalesEntryInput } from "@/lib/mock/service-config";

export const dynamic = "force-dynamic";

/** Shared auth: load the transaction and confirm the persona may act on its site. */
async function loadAndAuthorize(id: string, persona: Persona) {
  const existing = await getDailyTransactionById(id);
  if (!existing) return { ok: false as const, status: 404, message: "Transaksi tidak ditemukan." };
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

/** GET /api/daily-sales/:id — one entry with its line items. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  try {
    const result = await getDailyTransactionWithLines(id);
    if (!result) return NextResponse.json({ error: "Transaksi tidak ditemukan." }, { status: 404 });
    if (!canAccessLocation(auth.persona, result.header.locationId, result.header.projectId)) {
      return NextResponse.json({ error: "Tidak ada akses ke transaksi ini." }, { status: 403 });
    }
    return NextResponse.json({ source: "db", ...result });
  } catch {
    return NextResponse.json({ error: "Database tidak tersedia." }, { status: 503 });
  }
}

/** PATCH /api/daily-sales/:id — replace the entry's values after validation. */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;
  if (persona.role === "viewer") {
    return NextResponse.json({ error: "Viewer tidak dapat mengubah daily sales." }, { status: 403 });
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
    const areaId = typeof body.areaId === "string" ? body.areaId : (existing.areaId ?? undefined);
    const values = (body.values && typeof body.values === "object" ? body.values : {}) as SalesEntryInput;

    const prepared = prepareDailySalesSubmission({
      projectId: existing.projectId,
      locationId: existing.locationId,
      trxDate,
      area,
      areaId,
      values,
      submittedBy: persona.name,
    });
    if (!prepared.ok) {
      return NextResponse.json({ error: "Validasi gagal.", errors: prepared.errors }, { status: 422 });
    }

    if (await isPeriodLocked(existing.projectId, existing.locationId, prepared.input.trxDate)) {
      return NextResponse.json(
        { error: "Periode terkunci — entri tidak dapat diubah." },
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

/** DELETE /api/daily-sales/:id — remove an entry (lines cascade). */
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;
  if (persona.role === "viewer") {
    return NextResponse.json({ error: "Viewer tidak dapat menghapus daily sales." }, { status: 403 });
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
