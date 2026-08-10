import { NextResponse, type NextRequest } from "next/server";
import {
  getDanaCashTransactionById,
  updateDanaCashTransaction,
  softDeleteDanaCashTransaction,
} from "@/db/repositories/dana-cash-repository";
import { isPeriodLocked } from "@/db/repositories/lock-period-repository";
import { requirePersona } from "@/lib/server/rbac";
import { canAccessLocation } from "@/lib/personas";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/dana-cash/:id
 * Body: { trxDate?, direction?, categoryKey?, description?, amount? }
 * Updates a Dana Cash transaction; records an audit entry with before/after
 * amount. Restricted to input-capable personas with site access.
 */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;
  if (persona.role === "viewer") {
    return NextResponse.json({ error: "Viewer tidak dapat mengubah transaksi kas." }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Body JSON tidak valid." }, { status: 400 });
  }

  try {
    const existing = await getDanaCashTransactionById(id);
    if (!existing) return NextResponse.json({ error: "Transaksi tidak ditemukan." }, { status: 404 });
    if (!canAccessLocation(persona, existing.locationId, existing.projectId)) {
      return NextResponse.json({ error: "Tidak ada akses ke transaksi ini." }, { status: 403 });
    }
    // Locked-period guard: cannot edit a transaction whose current or target
    // date falls in a locked period.
    const targetDate =
      typeof body.trxDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.trxDate)
        ? body.trxDate
        : existing.trxDate;
    try {
      if (await isPeriodLocked(existing.projectId, existing.locationId, targetDate)) {
        return NextResponse.json({ error: "Periode terkunci — transaksi tidak dapat diubah." }, { status: 409 });
      }
    } catch {
      // lock table unavailable → allow
    }

    const patch: Record<string, unknown> = {};
    if (typeof body.trxDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.trxDate)) {
      patch.trxDate = body.trxDate;
    }
    if (body.direction === "top_up" || body.direction === "expense") patch.direction = body.direction;
    if (typeof body.categoryKey === "string") patch.categoryKey = body.categoryKey;
    if (typeof body.description === "string") patch.description = body.description;
    if (body.amount !== undefined) {
      const amount = Number(body.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        return NextResponse.json({ error: "amount harus angka > 0." }, { status: 422 });
      }
      patch.amount = amount.toFixed(2);
    }

    const row = await updateDanaCashTransaction(id, existing.projectId, patch, persona.name);
    return NextResponse.json({ source: "db", transaction: row });
  } catch {
    return NextResponse.json({ error: "Database tidak tersedia." }, { status: 503 });
  }
}

/**
 * DELETE /api/dana-cash/:id
 * Soft-deletes a Dana Cash transaction (with a delete audit entry). Restricted to
 * input-capable personas with site access.
 */
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;
  if (persona.role === "viewer") {
    return NextResponse.json({ error: "Viewer tidak dapat menghapus transaksi kas." }, { status: 403 });
  }

  try {
    const existing = await getDanaCashTransactionById(id);
    if (!existing) return NextResponse.json({ error: "Transaksi tidak ditemukan." }, { status: 404 });
    if (!canAccessLocation(persona, existing.locationId, existing.projectId)) {
      return NextResponse.json({ error: "Tidak ada akses ke transaksi ini." }, { status: 403 });
    }
    const ok = await softDeleteDanaCashTransaction(id, existing.projectId, persona.name);
    return NextResponse.json({ source: "db", deleted: ok });
  } catch {
    return NextResponse.json({ error: "Database tidak tersedia." }, { status: 503 });
  }
}
