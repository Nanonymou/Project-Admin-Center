import { NextResponse, type NextRequest } from "next/server";
import { listMealPrices } from "@/db/repositories/meal-price-repository";
import { requirePersona } from "@/lib/server/rbac";
import { canAccessLocation } from "@/lib/personas";
import { getPricedCategories } from "@/lib/mock/pricing-config";

export const dynamic = "force-dynamic";

const isMeal = (key: string) => key.startsWith("meals") || key === "snack_box" || key === "air_minum";

/**
 * GET /api/harga-meals/active?projectCode=&locationId=
 *
 * The currently ACTIVE meal prices for a site — the effective price list used by
 * downstream flows (e.g. Daily Sales). Falls back to the config-derived defaults
 * when no DB rows exist, so it always returns a usable price list.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const projectCode = sp.get("projectCode") ?? "";
  const locationId = sp.get("locationId") ?? "";

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
    const rows = await listMealPrices({ projectCode, locationId, activeOnly: true });
    if (rows.length === 0) throw new Error("empty");
    return NextResponse.json({
      source: "db",
      count: rows.length,
      prices: rows.map((r) => ({ categoryKey: r.categoryKey, label: r.label, unit: r.unit, price: r.price })),
    });
  } catch {
    const cats = getPricedCategories(projectCode, locationId)
      .filter((c) => !c.deduction)
      .map((c) => ({ categoryKey: c.key, label: c.label, unit: c.unit, price: String(c.price), meal: isMeal(c.key) }));
    return NextResponse.json({ source: "config", count: cats.length, prices: cats });
  }
}
