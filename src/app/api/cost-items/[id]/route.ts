import { NextResponse, type NextRequest } from "next/server";
import {
  getCostItemById,
  updateCostItem,
  softDeleteCostItem,
} from "@/db/repositories/cost-item-repository";
import { requirePersona } from "@/lib/server/rbac";
import { canAccessLocation } from "@/lib/personas";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/cost-items/:id
 * Body: { categoryKey?, label?, qty?, unitPrice?, note? }
 * Updates a cost item; when qty or unitPrice changes the amount is recomputed
 * server-side. Restricted to configure-capable personas with site access.
 */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;
  if (!persona.capabilities.canConfigure) {
    return NextResponse.json({ error: "Tidak memiliki hak mengubah item biaya." }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Body JSON tidak valid." }, { status: 400 });
  }

  try {
    const existing = await getCostItemById(id);
    if (!existing) return NextResponse.json({ error: "Item tidak ditemukan." }, { status: 404 });
    if (!canAccessLocation(persona, existing.locationId, existing.projectId)) {
      return NextResponse.json({ error: "Tidak ada akses ke item ini." }, { status: 403 });
    }

    const qty = body.qty !== undefined ? Number(body.qty) : Number(existing.qty);
    const unitPrice = body.unitPrice !== undefined ? Number(body.unitPrice) : Number(existing.unitPrice);
    if (!Number.isFinite(qty) || qty < 0 || !Number.isFinite(unitPrice) || unitPrice < 0) {
      return NextResponse.json({ error: "qty dan unitPrice harus angka >= 0." }, { status: 422 });
    }

    const row = await updateCostItem(id, existing.projectId, {
      categoryKey: typeof body.categoryKey === "string" ? body.categoryKey : existing.categoryKey,
      label: typeof body.label === "string" ? body.label.trim() : existing.label,
      qty: qty.toFixed(2),
      unitPrice: unitPrice.toFixed(2),
      amount: (Math.max(0, qty) * Math.max(0, unitPrice)).toFixed(2),
      note: typeof body.note === "string" ? body.note : existing.note,
    });
    return NextResponse.json({ source: "db", item: row });
  } catch {
    return NextResponse.json({ error: "Database tidak tersedia." }, { status: 503 });
  }
}

/**
 * DELETE /api/cost-items/:id
 * Soft-deletes a cost item. Restricted to configure-capable personas with site
 * access.
 */
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;
  if (!persona.capabilities.canConfigure) {
    return NextResponse.json({ error: "Tidak memiliki hak menghapus item biaya." }, { status: 403 });
  }

  try {
    const existing = await getCostItemById(id);
    if (!existing) return NextResponse.json({ error: "Item tidak ditemukan." }, { status: 404 });
    if (!canAccessLocation(persona, existing.locationId, existing.projectId)) {
      return NextResponse.json({ error: "Tidak ada akses ke item ini." }, { status: 403 });
    }
    const ok = await softDeleteCostItem(id, existing.projectId, persona.name);
    return NextResponse.json({ source: "db", deleted: ok });
  } catch {
    return NextResponse.json({ error: "Database tidak tersedia." }, { status: 503 });
  }
}
