import { NextResponse, type NextRequest } from "next/server";
import {
  listMasterCategories,
  upsertMasterCategory,
  setMasterCategoryActive,
} from "@/db/repositories/master-category-repository";
import { requirePersona } from "@/lib/server/rbac";
import { validateCategoryInput } from "@/lib/server/services/category-validation-service";
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

/**
 * POST /api/master/categories — create/update a master category (upsert).
 * Body: { projectId, kind, categoryKey, label, unit?, defaultPrice?, isDeduction?, subCategory? }
 * Authorization: Leader/Super Admin (canConfigure).
 */
export async function POST(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;
  if (!persona.capabilities.canConfigure) {
    return NextResponse.json({ error: "Hanya Leader/Super Admin yang dapat mengubah kategori." }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Body JSON tidak valid." }, { status: 400 });
  }

  const projectId = typeof body.projectId === "string" ? body.projectId : "";
  const kind = body.kind === "sales" || body.kind === "cost" ? body.kind : null;
  const categoryKey = typeof body.categoryKey === "string" ? body.categoryKey : "";
  const label = typeof body.label === "string" ? body.label.trim() : "";
  const unit = typeof body.unit === "string" ? body.unit : null;
  const subCategory = typeof body.subCategory === "string" ? body.subCategory : null;
  const defaultPrice = Number(body.defaultPrice ?? 0);
  const isDeduction = Boolean(body.isDeduction);

  if (!projectId) {
    return NextResponse.json({ error: "projectId wajib diisi." }, { status: 400 });
  }
  const errors = validateCategoryInput({ kind, categoryKey, label, defaultPrice });
  if (errors.length > 0 || !kind) {
    return NextResponse.json({ error: errors[0]?.message ?? "kind tidak valid.", errors }, { status: 422 });
  }
  if (!canAccessProject(persona, projectId)) {
    return NextResponse.json({ error: `Tidak ada akses ke project ${projectId}.` }, { status: 403 });
  }

  try {
    await upsertMasterCategory({
      projectCode: projectId,
      kind,
      categoryKey,
      label,
      unit,
      subCategory,
      defaultPrice: defaultPrice.toFixed(2),
      isDeduction,
      active: true,
      createdBy: persona.name,
    });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Gagal menyimpan kategori (database tidak tersedia)." }, { status: 503 });
  }
}

/**
 * PATCH /api/master/categories — activate/deactivate a master category.
 * Body: { projectId, kind, categoryKey, active }
 * Authorization: Leader/Super Admin.
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

  const projectId = typeof body.projectId === "string" ? body.projectId : "";
  const kind = body.kind === "sales" || body.kind === "cost" ? body.kind : null;
  const categoryKey = typeof body.categoryKey === "string" ? body.categoryKey : "";
  const active = Boolean(body.active);

  if (!projectId || !kind || !categoryKey) {
    return NextResponse.json({ error: "projectId, kind, dan categoryKey wajib diisi." }, { status: 400 });
  }
  if (!canAccessProject(persona, projectId)) {
    return NextResponse.json({ error: `Tidak ada akses ke project ${projectId}.` }, { status: 403 });
  }

  try {
    await setMasterCategoryActive(projectId, kind, categoryKey, active);
    return NextResponse.json({ ok: true, active });
  } catch {
    return NextResponse.json({ error: "Gagal mengubah status (database tidak tersedia)." }, { status: 503 });
  }
}
