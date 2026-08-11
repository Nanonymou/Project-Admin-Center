import { NextResponse, type NextRequest } from "next/server";
import {
  listMealPrices,
  getMealPrice,
  upsertMealPrice,
  setMealPriceActive,
  recordMealPriceChange,
} from "@/db/repositories/meal-price-repository";
import { requirePersona } from "@/lib/server/rbac";
import { canAccessProject, canAccessLocation } from "@/lib/personas";
import { getPricedCategories } from "@/lib/mock/pricing-config";

export const dynamic = "force-dynamic";

/** Meal categories float to the top of Harga Meals; mirrors the UI grouping. */
const isMeal = (key: string) => key.startsWith("meals") || key === "snack_box" || key === "air_minum";

/**
 * GET /api/harga-meals?projectCode=&locationId=
 *
 * Harga Meals list for a site. Falls back to config-derived meal prices (pricing
 * engine) when the database has no rows, so the endpoint always responds. Any
 * authenticated persona with project access can read.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const projectCode = sp.get("projectCode") ?? undefined;
  const locationId = sp.get("locationId") ?? undefined;

  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;

  if (!projectCode || !locationId) {
    return NextResponse.json({ error: "projectCode dan locationId wajib diisi." }, { status: 400 });
  }
  if (!canAccessLocation(persona, locationId, projectCode)) {
    return NextResponse.json({ error: `Tidak ada akses ke lokasi ${locationId}.` }, { status: 403 });
  }

  try {
    const rows = await listMealPrices({ projectCode, locationId, activeOnly: false });
    if (rows.length === 0) throw new Error("empty");
    return NextResponse.json({ source: "db", projectCode, locationId, count: rows.length, prices: rows });
  } catch {
    // Config fallback: derive default meal prices from the pricing engine.
    const cats = getPricedCategories(projectCode, locationId)
      .filter((c) => !c.deduction)
      .map((c) => ({
        categoryKey: c.key,
        label: c.label,
        unit: c.unit,
        price: String(c.price),
        custom: false,
        active: true,
        meal: isMeal(c.key),
      }));
    return NextResponse.json({ source: "config", projectCode, locationId, count: cats.length, prices: cats });
  }
}

/**
 * POST /api/harga-meals — create/update a meal price (upsert).
 * Body: { projectCode, locationId, categoryKey, label, unit, price, custom? }
 * Authorization: Leader/Super Admin only (canConfigure).
 */
export async function POST(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;
  if (!persona.capabilities.canConfigure) {
    return NextResponse.json({ error: "Hanya Leader/Super Admin yang dapat mengubah harga." }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Body JSON tidak valid." }, { status: 400 });
  }

  const projectCode = typeof body.projectCode === "string" ? body.projectCode : "";
  const locationId = typeof body.locationId === "string" ? body.locationId : "";
  const categoryKey = typeof body.categoryKey === "string" ? body.categoryKey : "";
  const label = typeof body.label === "string" ? body.label.trim() : "";
  const unit = typeof body.unit === "string" && body.unit.trim() ? body.unit.trim() : "unit";
  const price = Number(body.price);
  const custom = Boolean(body.custom);

  if (!projectCode || !locationId || !categoryKey || !label) {
    return NextResponse.json(
      { error: "projectCode, locationId, categoryKey, dan label wajib diisi." },
      { status: 400 },
    );
  }
  if (Number.isNaN(price) || price < 0) {
    return NextResponse.json({ error: "price tidak valid." }, { status: 422 });
  }
  if (!canAccessProject(persona, projectCode) || !canAccessLocation(persona, locationId, projectCode)) {
    return NextResponse.json({ error: `Tidak ada akses ke lokasi ${locationId}.` }, { status: 403 });
  }

  try {
    const existing = await getMealPrice(projectCode, locationId, categoryKey);
    await upsertMealPrice({
      projectCode,
      locationId,
      categoryKey,
      label,
      unit,
      price: price.toFixed(2),
      custom,
      active: true,
      createdBy: persona.name,
    });
    // Non-destructive history: create when new, update when the price changed.
    const before = existing ? Number(existing.price) : null;
    if (!existing || before !== price) {
      await recordMealPriceChange({
        projectCode,
        locationId,
        categoryKey,
        categoryLabel: label,
        action: existing ? "update" : "create",
        beforePrice: before === null ? null : before.toFixed(2),
        afterPrice: price.toFixed(2),
        changedBy: persona.name,
      });
    }
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Gagal menyimpan harga (database tidak tersedia)." }, { status: 503 });
  }
}

/**
 * PATCH /api/harga-meals — activate/deactivate a meal price.
 * Body: { projectCode, locationId, categoryKey, active }
 * Authorization: Leader/Super Admin only.
 */
export async function PATCH(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;
  if (!persona.capabilities.canConfigure) {
    return NextResponse.json({ error: "Hanya Leader/Super Admin yang dapat mengubah status." }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Body JSON tidak valid." }, { status: 400 });
  }

  const projectCode = typeof body.projectCode === "string" ? body.projectCode : "";
  const locationId = typeof body.locationId === "string" ? body.locationId : "";
  const categoryKey = typeof body.categoryKey === "string" ? body.categoryKey : "";
  const active = Boolean(body.active);

  if (!projectCode || !locationId || !categoryKey) {
    return NextResponse.json(
      { error: "projectCode, locationId, dan categoryKey wajib diisi." },
      { status: 400 },
    );
  }
  if (!canAccessLocation(persona, locationId, projectCode)) {
    return NextResponse.json({ error: `Tidak ada akses ke lokasi ${locationId}.` }, { status: 403 });
  }

  try {
    const existing = await getMealPrice(projectCode, locationId, categoryKey);
    await setMealPriceActive(projectCode, locationId, categoryKey, active);
    await recordMealPriceChange({
      projectCode,
      locationId,
      categoryKey,
      categoryLabel: existing?.label ?? categoryKey,
      action: active ? "activate" : "deactivate",
      beforePrice: null,
      afterPrice: null,
      changedBy: persona.name,
    });
    return NextResponse.json({ ok: true, active });
  } catch {
    return NextResponse.json({ error: "Gagal mengubah status (database tidak tersedia)." }, { status: 503 });
  }
}
