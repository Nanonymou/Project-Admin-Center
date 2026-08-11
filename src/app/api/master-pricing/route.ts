import { NextResponse, type NextRequest } from "next/server";
import { requirePersona } from "@/lib/server/rbac";
import { canAccessProject } from "@/lib/personas";
import { listMasterPrices } from "@/db/repositories/master-price-repository";
import { getServiceCategories } from "@/lib/mock/service-config";
import { getPriceFor, getPricedCategories } from "@/lib/mock/pricing-config";
import { MOCK_WORKSPACES } from "@/lib/mock/workspaces";

export const dynamic = "force-dynamic";

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
