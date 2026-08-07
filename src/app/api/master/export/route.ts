import { NextResponse, type NextRequest } from "next/server";
import { listMasterCategories } from "@/db/repositories/master-category-repository";
import { listMasterTimeframes } from "@/db/repositories/master-timeframe-repository";
import { requirePersona } from "@/lib/server/rbac";
import { canAccessProject, canAccessLocation } from "@/lib/personas";
import { toCsv } from "@/lib/csv";
import { getServiceCategories } from "@/lib/mock/service-config";
import { getCostCategories } from "@/lib/mock/cost-config";
import { getApprovalTimeframes } from "@/lib/mock/approval-timeframe-config";
import { getAreasFor } from "@/lib/mock/area-config";
import { SITE_KPI } from "@/lib/mock/site-kpi";

export const dynamic = "force-dynamic";

function csvResponse(name: string, rows: (string | number)[][]): NextResponse {
  return new NextResponse(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv;charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}.csv"`,
    },
  });
}

/**
 * GET /api/master/export?type=categories|timeframes|areas&projectId=
 * Exports a master-data table as Excel-compatible CSV. Requires an authenticated
 * persona with export rights and access to the project. Falls back to
 * config-derived data when the database is unavailable.
 */
export async function GET(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;
  if (!persona.capabilities.canExport) {
    return NextResponse.json({ error: "Persona ini tidak memiliki hak ekspor." }, { status: 403 });
  }

  const sp = req.nextUrl.searchParams;
  const type = sp.get("type") ?? "categories";
  const projectId = sp.get("projectId") ?? undefined;
  if (!projectId) return NextResponse.json({ error: "projectId wajib diisi." }, { status: 400 });
  if (!canAccessProject(persona, projectId)) {
    return NextResponse.json({ error: `Tidak ada akses ke project ${projectId}.` }, { status: 403 });
  }

  if (type === "categories") {
    let data: (string | number)[][];
    try {
      const rows = await listMasterCategories({ projectCode: projectId, activeOnly: true });
      if (rows.length === 0) throw new Error("empty");
      data = rows.map((r) => [r.kind, r.categoryKey, r.label, r.subCategory ?? "", r.unit ?? "", r.defaultPrice, r.isDeduction ? "1" : "0"]);
    } catch {
      data = [
        ...getServiceCategories(projectId).map((c) => ["sales", c.key, c.label, "", c.unit, c.defaultPrice, c.deduction ? "1" : "0"] as (string | number)[]),
        ...getCostCategories(projectId).map((c) => ["cost", c.key, c.label, "", "", 0, "0"] as (string | number)[]),
      ];
    }
    return csvResponse(`master-categories-${projectId}`, [
      ["kind", "categoryKey", "label", "subCategory", "unit", "defaultPrice", "isDeduction"],
      ...data,
    ]);
  }

  if (type === "timeframes") {
    let data: (string | number)[][];
    try {
      const rows = await listMasterTimeframes({ projectCode: projectId, activeOnly: true });
      if (rows.length === 0) throw new Error("empty");
      data = rows.map((r) => [r.subjectType, r.stage, r.slaDays, r.orderIndex]);
    } catch {
      data = (["invoice", "daily_closing"] as const).flatMap((t) =>
        getApprovalTimeframes(projectId, t).map((tf) => [t, tf.stage, tf.slaDays, tf.order] as (string | number)[]),
      );
    }
    return csvResponse(`master-timeframes-${projectId}`, [
      ["subjectType", "stage", "slaDays", "orderIndex"],
      ...data,
    ]);
  }

  if (type === "areas") {
    const sites = SITE_KPI.filter(
      (s) => s.projectCode === projectId && canAccessLocation(persona, s.locationId, s.projectCode),
    );
    const data = sites.flatMap((s) =>
      getAreasFor(s.locationId, s.locationName).map((a) => [s.locationId, s.locationName, a.id, a.name] as (string | number)[]),
    );
    return csvResponse(`master-areas-${projectId}`, [
      ["locationId", "locationName", "areaCode", "areaName"],
      ...data,
    ]);
  }

  return NextResponse.json(
    { error: "type tidak dikenal (categories|timeframes|areas)." },
    { status: 400 },
  );
}
