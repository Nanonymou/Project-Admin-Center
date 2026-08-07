import { NextResponse, type NextRequest } from "next/server";
import { listMasterCategories } from "@/db/repositories/master-category-repository";
import { requirePersona } from "@/lib/server/rbac";
import { canAccessProject } from "@/lib/personas";
import { getServiceCategories } from "@/lib/mock/service-config";
import { getCostCategories } from "@/lib/mock/cost-config";
import { getPriceFor } from "@/lib/mock/pricing-config";

export const dynamic = "force-dynamic";

/**
 * GET /api/master/categories?projectId=&locationId=&kind=sales|cost
 * Master data for daily entry forms: meal/service categories and cost types with
 * their default prices. When `locationId` is given, sales prices are resolved
 * from the location's master pricing. Requires an authenticated persona with
 * access to the project. Falls back to config-derived master data when the
 * database is unavailable.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const projectId = sp.get("projectId") ?? undefined;
  const locationId = sp.get("locationId") ?? undefined;
  const kindRaw = sp.get("kind");
  const kind = kindRaw === "sales" || kindRaw === "cost" ? kindRaw : undefined;

  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;

  if (!projectId) {
    return NextResponse.json({ error: "projectId wajib diisi." }, { status: 400 });
  }
  if (!canAccessProject(persona, projectId)) {
    return NextResponse.json({ error: `Tidak ada akses ke project ${projectId}.` }, { status: 403 });
  }

  try {
    const rows = await listMasterCategories({ projectCode: projectId, kind, activeOnly: true });
    const categories = rows.map((r) => {
      const price =
        r.kind === "sales" && locationId
          ? getPriceFor(projectId, locationId, r.categoryKey)
          : Number(r.defaultPrice);
      return {
        kind: r.kind,
        categoryKey: r.categoryKey,
        label: r.label,
        subCategory: r.subCategory,
        unit: r.unit,
        price,
        isDeduction: r.isDeduction,
      };
    });
    return NextResponse.json({ source: "db", projectId, kind, count: categories.length, categories });
  } catch {
    const categories: {
      kind: "sales" | "cost";
      categoryKey: string;
      label: string;
      unit?: string;
      price: number;
      isDeduction: boolean;
    }[] = [];
    if (!kind || kind === "sales") {
      for (const c of getServiceCategories(projectId)) {
        categories.push({
          kind: "sales",
          categoryKey: c.key,
          label: c.label,
          unit: c.unit,
          price: locationId ? getPriceFor(projectId, locationId, c.key) : c.defaultPrice,
          isDeduction: Boolean(c.deduction),
        });
      }
    }
    if (!kind || kind === "cost") {
      for (const c of getCostCategories(projectId)) {
        categories.push({
          kind: "cost",
          categoryKey: c.key,
          label: c.label,
          price: 0,
          isDeduction: false,
        });
      }
    }
    return NextResponse.json({ source: "mock", projectId, kind, count: categories.length, categories });
  }
}
