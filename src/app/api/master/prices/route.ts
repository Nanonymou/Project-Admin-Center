import { NextResponse, type NextRequest } from "next/server";
import {
  listMasterPrices,
  upsertMasterPrices,
} from "@/db/repositories/master-price-repository";
import type { NewMasterPrice } from "@/db/schema";
import { requirePersona } from "@/lib/server/rbac";
import { canAccessProject, canAccessLocation } from "@/lib/personas";
import { getServiceCategories } from "@/lib/mock/service-config";
import { getPriceFor } from "@/lib/mock/pricing-config";
import { MOCK_WORKSPACES } from "@/lib/mock/workspaces";

export const dynamic = "force-dynamic";

/**
 * GET /api/master/prices?projectId=&locationId=&categoryKey=
 *
 * Per-location master price list for a project. When the database is unavailable,
 * falls back to config-derived per-location prices (from the pricing engine) so
 * the endpoint always responds. Requires an authenticated persona with access to
 * the project.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const projectId = sp.get("projectId") ?? undefined;
  const locationId = sp.get("locationId") ?? undefined;
  const categoryKey = sp.get("categoryKey") ?? undefined;

  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;

  if (!projectId) {
    return NextResponse.json({ error: "projectId wajib diisi." }, { status: 400 });
  }
  if (!canAccessProject(persona, projectId)) {
    return NextResponse.json({ error: `Tidak ada akses ke project ${projectId}.` }, { status: 403 });
  }
  if (locationId && !canAccessLocation(persona, locationId, projectId)) {
    return NextResponse.json({ error: `Tidak ada akses ke lokasi ${locationId}.` }, { status: 403 });
  }

  try {
    const rows = (await listMasterPrices({ projectCode: projectId, locationId, categoryKey, activeOnly: true }))
      .filter((r) => canAccessLocation(persona, r.locationId, r.projectCode));
    if (rows.length === 0) throw new Error("empty");
    return NextResponse.json({
      source: "db",
      projectId,
      count: rows.length,
      prices: rows.map((r) => ({
        locationId: r.locationId,
        categoryKey: r.categoryKey,
        price: Number(r.price),
        effectiveFrom: r.effectiveFrom,
      })),
    });
  } catch {
    // Config fallback — derive per-location prices from the pricing engine.
    const sales = getServiceCategories(projectId);
    let locations = MOCK_WORKSPACES.filter(
      (w) => w.projectCode === projectId && canAccessLocation(persona, w.locationId, w.projectCode),
    );
    if (locationId) locations = locations.filter((w) => w.locationId === locationId);
    const prices = locations.flatMap((w) =>
      sales
        .filter((c) => !categoryKey || c.key === categoryKey)
        .map((c) => ({
          locationId: w.locationId,
          categoryKey: c.key,
          price: getPriceFor(projectId, w.locationId, c.key),
          effectiveFrom: null as string | null,
        })),
    );
    return NextResponse.json({ source: "mock", projectId, count: prices.length, prices });
  }
}

/**
 * POST /api/master/prices
 * Body: { projectId, prices: [{ locationId, categoryKey, price, effectiveFrom? }] }
 *
 * Upsert per-location prices. Restricted to configure-capable personas with
 * access to the project and each target location.
 */
export async function POST(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;
  if (!persona.capabilities.canConfigure) {
    return NextResponse.json({ error: "Tidak memiliki hak konfigurasi harga." }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Body JSON tidak valid." }, { status: 400 });
  }

  const projectId = typeof body.projectId === "string" ? body.projectId : "";
  const rawPrices = Array.isArray(body.prices) ? body.prices : [];
  if (!projectId || rawPrices.length === 0) {
    return NextResponse.json({ error: "projectId dan prices wajib diisi." }, { status: 400 });
  }
  if (!canAccessProject(persona, projectId)) {
    return NextResponse.json({ error: `Tidak ada akses ke project ${projectId}.` }, { status: 403 });
  }

  const values: NewMasterPrice[] = [];
  for (const p of rawPrices as Record<string, unknown>[]) {
    const locationId = typeof p.locationId === "string" ? p.locationId : "";
    const categoryKey = typeof p.categoryKey === "string" ? p.categoryKey : "";
    const price = Number(p.price);
    if (!locationId || !categoryKey || !Number.isFinite(price) || price < 0) {
      return NextResponse.json(
        { error: "Setiap baris butuh locationId, categoryKey, dan price >= 0." },
        { status: 422 },
      );
    }
    if (!canAccessLocation(persona, locationId, projectId)) {
      return NextResponse.json({ error: `Tidak ada akses ke lokasi ${locationId}.` }, { status: 403 });
    }
    values.push({
      projectCode: projectId,
      locationId,
      categoryKey,
      price: price.toFixed(2),
      effectiveFrom: typeof p.effectiveFrom === "string" ? p.effectiveFrom : null,
      active: true,
      createdBy: persona.name,
    });
  }

  try {
    const count = await upsertMasterPrices(values);
    return NextResponse.json({ source: "db", projectId, upserted: count });
  } catch {
    return NextResponse.json({ source: "mock", projectId, upserted: values.length });
  }
}
