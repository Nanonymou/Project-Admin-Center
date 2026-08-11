import { NextResponse, type NextRequest } from "next/server";
import { listMealPriceHistory } from "@/db/repositories/meal-price-repository";
import { requirePersona } from "@/lib/server/rbac";
import { canAccessLocation } from "@/lib/personas";

export const dynamic = "force-dynamic";

/**
 * GET /api/harga-meals/history?projectCode=&locationId=
 *
 * Non-destructive meal-price change history for a site (newest first). Returns
 * an empty list when the database is unavailable rather than erroring, so the UI
 * degrades gracefully. Requires access to the location.
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
    const history = await listMealPriceHistory(projectCode, locationId);
    return NextResponse.json({ source: "db", count: history.length, history });
  } catch {
    return NextResponse.json({ source: "unavailable", count: 0, history: [] });
  }
}
