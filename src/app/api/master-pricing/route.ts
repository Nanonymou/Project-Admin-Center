import { NextResponse, type NextRequest } from "next/server";
import { requirePersona } from "@/lib/server/rbac";
import { canAccessLocation, canAccessProject } from "@/lib/personas";
import {
  listMasterPrices,
  upsertMasterPrice,
  upsertMasterPrices,
} from "@/db/repositories/master-price-repository";
import { recordMasterPriceChange } from "@/db/repositories/master-price-history-repository";
import { getServiceCategories } from "@/lib/mock/service-config";
import { getPriceFor, getPricedCategories } from "@/lib/mock/pricing-config";
import { MOCK_WORKSPACES } from "@/lib/mock/workspaces";

export const dynamic = "force-dynamic";

/** Resolve a category's display label within a project, or the key itself. */
function labelFor(projectCode: string, categoryKey: string): string {
  return getServiceCategories(projectCode).find((c) => c.key === categoryKey)?.label ?? categoryKey;
}

/**
 * GET /api/master-pricing?projectId=&locationId=
 *
 * The effective price list for a project (Master Pricing Engine). For each
 * service category, the effective price resolves as: the per-location override
 * from `master_prices` when present, otherwise the config-derived location price
 * (or the category default when no location is given). When `locationId` is
 * omitted the whole project's per-location list is returned. Falls back entirely
 * to config when the DB is unavailable. Requires access to the project.
 */
export async function GET(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;

  const sp = req.nextUrl.searchParams;
  const projectId = sp.get("projectId") ?? "";
  const locationId = sp.get("locationId") ?? undefined;

  if (!projectId) {
    return NextResponse.json({ error: "projectId wajib diisi." }, { status: 400 });
  }
  if (!canAccessProject(persona, projectId)) {
    return NextResponse.json({ error: `Tidak ada akses ke project ${projectId}.` }, { status: 403 });
  }

  const categories = getServiceCategories(projectId);
  // Locations to resolve: the requested one, or every site under the project.
  const locations = locationId
    ? [locationId]
    : MOCK_WORKSPACES.filter((w) => w.projectCode === projectId).map((w) => w.locationId);

  try {
    const rows = await listMasterPrices({ projectCode: projectId, locationId, activeOnly: true });
    // Map (locationId → categoryKey → override price) from the DB.
    const overrides = new Map<string, Map<string, number>>();
    for (const r of rows) {
      const perLoc = overrides.get(r.locationId) ?? new Map<string, number>();
      perLoc.set(r.categoryKey, Number(r.price));
      overrides.set(r.locationId, perLoc);
    }

    const prices = locations.flatMap((loc) =>
      categories.map((c) => {
        const override = overrides.get(loc)?.get(c.key);
        const effective = override ?? getPriceFor(projectId, loc, c.key);
        return {
          locationId: loc,
          categoryKey: c.key,
          label: c.label,
          unit: c.unit,
          isDeduction: Boolean(c.deduction),
          price: effective,
          source: override !== undefined ? ("db" as const) : ("derived" as const),
        };
      }),
    );
    return NextResponse.json({ source: "db", projectId, locationId: locationId ?? null, count: prices.length, prices });
  } catch {
    const prices = locations.flatMap((loc) =>
      getPricedCategories(projectId, loc).map((c) => ({
        locationId: loc,
        categoryKey: c.key,
        label: c.label,
        unit: c.unit,
        isDeduction: Boolean(c.deduction),
        price: c.price,
        source: "config" as const,
      })),
    );
    return NextResponse.json({ source: "config", projectId, locationId: locationId ?? null, count: prices.length, prices });
  }
}

/**
 * POST /api/master-pricing — add or update a per-location price for a category.
 * Body: { projectCode, locationId, categoryKey, price, effectiveFrom? }
 *
 * Upserts the price into `master_prices` and appends a non-destructive entry to
 * `master_price_history` (action create|update, with before/after). Leader/Super
 * Admin or the site's own admin. Price must be a non-negative number.
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

  const projectCode = typeof body.projectCode === "string" ? body.projectCode : "";
  const locationId = typeof body.locationId === "string" ? body.locationId : "";
  const categoryKey = typeof body.categoryKey === "string" ? body.categoryKey : "";
  const price = Number(body.price);
  const effectiveFrom = typeof body.effectiveFrom === "string" && body.effectiveFrom ? body.effectiveFrom : null;

  if (!projectCode || !locationId || !categoryKey) {
    return NextResponse.json({ error: "projectCode, locationId, dan categoryKey wajib diisi." }, { status: 400 });
  }
  if (Number.isNaN(price) || price < 0) {
    return NextResponse.json({ error: "price harus angka ≥ 0." }, { status: 422 });
  }
  if (persona.role === "viewer") {
    return NextResponse.json({ error: "Viewer tidak dapat mengubah harga." }, { status: 403 });
  }
  if (!canAccessLocation(persona, locationId, projectCode)) {
    return NextResponse.json({ error: `Tidak ada akses ke lokasi ${locationId}.` }, { status: 403 });
  }

  try {
    // Determine before-price for the history entry (null → this is a create).
    const existing = await listMasterPrices({ projectCode, locationId, categoryKey });
    const beforePrice = existing.length > 0 ? Number(existing[0].price) : null;

    await upsertMasterPrice({
      projectCode,
      locationId,
      categoryKey,
      price: price.toFixed(2),
      effectiveFrom,
      active: true,
      createdBy: persona.name,
    });
    await recordMasterPriceChange({
      projectCode,
      locationId,
      categoryKey,
      categoryLabel: labelFor(projectCode, categoryKey),
      action: beforePrice === null ? "create" : "update",
      beforePrice: beforePrice === null ? null : beforePrice.toFixed(2),
      afterPrice: price.toFixed(2),
      changedBy: persona.name,
    });
    return NextResponse.json({ ok: true, categoryKey, price }, { status: beforePrice === null ? 201 : 200 });
  } catch {
    return NextResponse.json({ error: "Gagal menyimpan harga (database tidak tersedia)." }, { status: 503 });
  }
}

/**
 * PUT /api/master-pricing — set multiple category prices with a shared effective
 * date, in one atomic batch (Master Pricing Engine "Set Harga & Tanggal Efektif").
 * Body: { projectCode, locationId, effectiveFrom, prices: [{ categoryKey, price }] }
 *
 * `effectiveFrom` is a period (YYYY-MM) marking when the new list takes effect;
 * it is stored on each row so the engine can version prices over time. Each
 * changed price appends a non-destructive history entry (create|update). All
 * upserts run in a single transaction so a partial batch never persists.
 * Leader/Super Admin or the site's own admin.
 */
export async function PUT(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Body JSON tidak valid." }, { status: 400 });
  }

  const projectCode = typeof body.projectCode === "string" ? body.projectCode : "";
  const locationId = typeof body.locationId === "string" ? body.locationId : "";
  const effectiveFrom = typeof body.effectiveFrom === "string" ? body.effectiveFrom.trim() : "";
  const rawPrices = Array.isArray(body.prices) ? body.prices : [];

  if (!projectCode || !locationId) {
    return NextResponse.json({ error: "projectCode dan locationId wajib diisi." }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}$/.test(effectiveFrom)) {
    return NextResponse.json({ error: "effectiveFrom harus format YYYY-MM." }, { status: 422 });
  }
  if (persona.role === "viewer") {
    return NextResponse.json({ error: "Viewer tidak dapat mengubah harga." }, { status: 403 });
  }
  if (!canAccessLocation(persona, locationId, projectCode)) {
    return NextResponse.json({ error: `Tidak ada akses ke lokasi ${locationId}.` }, { status: 403 });
  }

  // Normalize + validate the price entries.
  const entries: { categoryKey: string; price: number }[] = [];
  for (let i = 0; i < rawPrices.length; i++) {
    const p = rawPrices[i] as Record<string, unknown>;
    const categoryKey = typeof p?.categoryKey === "string" ? p.categoryKey : "";
    const price = Number(p?.price);
    if (!categoryKey) {
      return NextResponse.json({ error: `Baris #${i + 1} tidak punya categoryKey.` }, { status: 422 });
    }
    if (Number.isNaN(price) || price < 0) {
      return NextResponse.json({ error: `Harga untuk "${categoryKey}" tidak valid.` }, { status: 422 });
    }
    entries.push({ categoryKey, price });
  }
  if (entries.length === 0) {
    return NextResponse.json({ error: "Minimal satu harga wajib diisi." }, { status: 422 });
  }

  try {
    // Snapshot current prices so each history entry gets an accurate before-value.
    const current = await listMasterPrices({ projectCode, locationId });
    const before = new Map(current.map((r) => [r.categoryKey, Number(r.price)]));

    await upsertMasterPrices(
      entries.map((e) => ({
        projectCode,
        locationId,
        categoryKey: e.categoryKey,
        price: e.price.toFixed(2),
        effectiveFrom,
        active: true,
        createdBy: persona.name,
      })),
    );

    for (const e of entries) {
      const beforePrice = before.has(e.categoryKey) ? (before.get(e.categoryKey) as number) : null;
      await recordMasterPriceChange({
        projectCode,
        locationId,
        categoryKey: e.categoryKey,
        categoryLabel: labelFor(projectCode, e.categoryKey),
        action: beforePrice === null ? "create" : "update",
        beforePrice: beforePrice === null ? null : beforePrice.toFixed(2),
        afterPrice: e.price.toFixed(2),
        changedBy: persona.name,
      });
    }

    return NextResponse.json({ ok: true, effectiveFrom, saved: entries.length }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Gagal menyimpan harga (database tidak tersedia)." }, { status: 503 });
  }
}
