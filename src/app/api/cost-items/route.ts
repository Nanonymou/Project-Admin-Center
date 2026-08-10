import { NextResponse, type NextRequest } from "next/server";
import {
  listCostItems,
  createCostItem,
  type CostItemFilter,
} from "@/db/repositories/cost-item-repository";
import type { NewCostItem } from "@/db/schema";
import { requirePersona } from "@/lib/server/rbac";
import { canAccessLocation } from "@/lib/personas";

export const dynamic = "force-dynamic";

/**
 * GET /api/cost-items?projectId=&locationId=&batchId=
 * Lists cost items for the Total Otomatis calculator, scoped to the persona.
 * Falls back to an empty list when the database is unavailable.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const projectId = sp.get("projectId") ?? undefined;
  const scope = (sp.get("scope") as "tenant" | "executive" | null) ?? (projectId ? "tenant" : "executive");
  const filter: CostItemFilter = {
    projectId,
    locationId: sp.get("locationId") ?? undefined,
    batchId: sp.get("batchId") ?? undefined,
    scope,
  };

  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;

  try {
    const rows = (await listCostItems(filter)).filter((r) =>
      canAccessLocation(persona, r.locationId, r.projectId),
    );
    const total = rows.reduce((sum, r) => sum + Number(r.amount), 0);
    return NextResponse.json({ source: "db", count: rows.length, total, items: rows });
  } catch {
    return NextResponse.json({ source: "mock", count: 0, total: 0, items: [] });
  }
}

/** Compute the derived amount for a cost line (qty × unit price, >= 0). */
function lineAmount(qty: number, unitPrice: number): number {
  return Math.max(0, qty) * Math.max(0, unitPrice);
}

/**
 * POST /api/cost-items
 * Body: { projectId, locationId, batchId?, categoryKey, label, qty, unitPrice, note? }
 *
 * Creates a cost item; the amount is computed server-side. Restricted to
 * configure-capable personas with access to the target site.
 */
export async function POST(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;
  if (!persona.capabilities.canConfigure) {
    return NextResponse.json({ error: "Tidak memiliki hak mengelola item biaya." }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Body JSON tidak valid." }, { status: 400 });
  }

  const projectId = typeof body.projectId === "string" ? body.projectId : "";
  const locationId = typeof body.locationId === "string" ? body.locationId : "";
  const categoryKey = typeof body.categoryKey === "string" ? body.categoryKey : "";
  const label = typeof body.label === "string" ? body.label.trim() : "";
  const qty = Number(body.qty);
  const unitPrice = Number(body.unitPrice);

  if (!projectId || !locationId || !categoryKey || !label) {
    return NextResponse.json(
      { error: "projectId, locationId, categoryKey, dan label wajib diisi." },
      { status: 400 },
    );
  }
  if (!Number.isFinite(qty) || qty < 0 || !Number.isFinite(unitPrice) || unitPrice < 0) {
    return NextResponse.json({ error: "qty dan unitPrice harus angka >= 0." }, { status: 422 });
  }
  if (!canAccessLocation(persona, locationId, projectId)) {
    return NextResponse.json({ error: `Tidak ada akses ke lokasi ${locationId}.` }, { status: 403 });
  }

  const values: NewCostItem = {
    projectId,
    locationId,
    batchId: typeof body.batchId === "string" ? body.batchId : null,
    categoryKey,
    label,
    qty: qty.toFixed(2),
    unitPrice: unitPrice.toFixed(2),
    amount: lineAmount(qty, unitPrice).toFixed(2),
    note: typeof body.note === "string" ? body.note : null,
    createdBy: persona.name,
  };

  try {
    const row = await createCostItem(values);
    return NextResponse.json({ source: "db", item: row }, { status: 201 });
  } catch {
    return NextResponse.json(
      { source: "mock", item: { ...values, id: `mock-${Date.now()}` } },
      { status: 201 },
    );
  }
}
