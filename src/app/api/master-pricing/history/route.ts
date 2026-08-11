import { NextResponse, type NextRequest } from "next/server";
import { requirePersona } from "@/lib/server/rbac";
import { canAccessLocation, canAccessProject } from "@/lib/personas";
import { listMasterPriceHistory } from "@/db/repositories/master-price-history-repository";
import { buildPriceChanges } from "@/lib/mock/price-change-log";

export const dynamic = "force-dynamic";

/**
 * GET /api/master-pricing/history?projectId=&locationId=&categoryKey=&limit=
 *
 * The non-destructive price-change trail for the Master Pricing Engine, newest
 * first. Requires `projectId`; a `locationId` narrows to one site (and is scope-
 * checked). Falls back to the config-derived history (`buildPriceChanges`) when
 * the DB is unavailable, so the "Riwayat Perubahan Harga" view always renders.
 */
export async function GET(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;

  const sp = req.nextUrl.searchParams;
  const projectId = sp.get("projectId") ?? "";
  const locationId = sp.get("locationId") ?? undefined;
  const categoryKey = sp.get("categoryKey") ?? undefined;
  const limitRaw = Number(sp.get("limit"));
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : undefined;

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
    const rows = await listMasterPriceHistory({ projectCode: projectId, locationId, categoryKey, limit });
    if (rows.length === 0) throw new Error("empty");
    return NextResponse.json({
      source: "db",
      projectId,
      locationId: locationId ?? null,
      count: rows.length,
      history: rows.map((r) => ({
        id: r.id,
        categoryKey: r.categoryKey,
        categoryLabel: r.categoryLabel,
        action: r.action,
        before: r.beforePrice === null ? null : Number(r.beforePrice),
        after: r.afterPrice === null ? null : Number(r.afterPrice),
        changedBy: r.changedBy,
        at: r.createdAt,
      })),
    });
  } catch {
    // Config fallback: derive per-site history. Without a location, aggregate the
    // trail across every site the persona may access under the project.
    const { MOCK_WORKSPACES } = await import("@/lib/mock/workspaces");
    const sites = MOCK_WORKSPACES.filter(
      (w) =>
        w.projectCode === projectId &&
        (locationId ? w.locationId === locationId : canAccessLocation(persona, w.locationId, projectId)),
    );
    let history = sites.flatMap((w) => buildPriceChanges(projectId, w.locationId));
    if (categoryKey) history = history.filter((h) => h.categoryKey === categoryKey);
    history.sort((a, b) => b.at.localeCompare(a.at));
    if (limit) history = history.slice(0, limit);
    return NextResponse.json({
      source: "config",
      projectId,
      locationId: locationId ?? null,
      count: history.length,
      history: history.map((h) => ({
        id: h.id,
        categoryKey: h.categoryKey,
        categoryLabel: h.categoryLabel,
        action: h.action,
        before: h.before,
        after: h.after,
        changedBy: h.editor,
        at: h.at,
      })),
    });
  }
}
