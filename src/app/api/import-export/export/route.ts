import { NextResponse, type NextRequest } from "next/server";
import { recordImportExportJob } from "@/db/repositories/import-export-repository";
import { listMasterCategories } from "@/db/repositories/master-category-repository";
import { listMasterTimeframes } from "@/db/repositories/master-timeframe-repository";
import { listMasterAreas } from "@/db/repositories/master-area-repository";
import {
  listDailySubmissions,
  type DashboardFilter,
} from "@/db/repositories/daily-transaction-repository";
import { requirePersona } from "@/lib/server/rbac";
import { canAccessProject, canAccessLocation, type Persona } from "@/lib/personas";
import { parsePeriod } from "@/lib/server/period";
import { toCsv } from "@/lib/csv";
import { getServiceCategories } from "@/lib/mock/service-config";
import { getCostCategories } from "@/lib/mock/cost-config";
import { getApprovalTimeframes } from "@/lib/mock/approval-timeframe-config";
import { getAreasFor } from "@/lib/mock/area-config";
import { SITE_KPI } from "@/lib/mock/site-kpi";
import { SITE_DETAILS } from "@/lib/mock/site-detail";

export const dynamic = "force-dynamic";

type Loaded = { rows: (string | number)[][]; source: "db" | "mock" };
type Loader = (persona: Persona, filter: DashboardFilter) => Promise<Loaded>;

/**
 * Filtered-export modules. Each has a CSV header and a loader that reads from
 * its repository (falling back to config/mock data when the DB is unavailable),
 * applying the shared tenant/location filter. Kept in sync with the import and
 * template endpoints so a round-trip export→import shares the same columns.
 */
const MODULES: Record<string, { header: string[]; scope: "project" | "daily"; load: Loader }> = {
  categories: {
    header: ["kind", "categoryKey", "label", "subCategory", "unit", "defaultPrice", "isDeduction"],
    scope: "project",
    load: async (persona, filter) => {
      const projectId = filter.projectId!;
      try {
        const rows = await listMasterCategories({ projectCode: projectId, activeOnly: true });
        if (rows.length === 0) throw new Error("empty");
        return {
          source: "db",
          rows: rows.map((r) => [
            r.kind,
            r.categoryKey,
            r.label,
            r.subCategory ?? "",
            r.unit ?? "",
            r.defaultPrice,
            r.isDeduction ? "1" : "0",
          ]),
        };
      } catch {
        return {
          source: "mock",
          rows: [
            ...getServiceCategories(projectId).map(
              (c) =>
                ["sales", c.key, c.label, "", c.unit, c.defaultPrice, c.deduction ? "1" : "0"] as (
                  | string
                  | number
                )[],
            ),
            ...getCostCategories(projectId).map(
              (c) => ["cost", c.key, c.label, "", "", 0, "0"] as (string | number)[],
            ),
          ],
        };
      }
    },
  },
  timeframes: {
    header: ["subjectType", "stage", "slaDays", "orderIndex"],
    scope: "project",
    load: async (persona, filter) => {
      const projectId = filter.projectId!;
      try {
        const rows = await listMasterTimeframes({ projectCode: projectId, activeOnly: true });
        if (rows.length === 0) throw new Error("empty");
        return { source: "db", rows: rows.map((r) => [r.subjectType, r.stage, r.slaDays, r.orderIndex]) };
      } catch {
        return {
          source: "mock",
          rows: (["invoice", "daily_closing"] as const).flatMap((t) =>
            getApprovalTimeframes(projectId, t).map(
              (tf) => [t, tf.stage, tf.slaDays, tf.order] as (string | number)[],
            ),
          ),
        };
      }
    },
  },
  areas: {
    header: ["locationId", "locationName", "areaCode", "areaName"],
    scope: "project",
    load: async (persona, filter) => {
      const projectId = filter.projectId!;
      let sites = SITE_KPI.filter(
        (s) => s.projectCode === projectId && canAccessLocation(persona, s.locationId, s.projectCode),
      );
      if (filter.locationId) sites = sites.filter((s) => s.locationId === filter.locationId);
      try {
        const rows: (string | number)[][] = [];
        for (const s of sites) {
          const areas = await listMasterAreas(projectId, s.locationId);
          if (areas.length === 0) throw new Error("empty");
          for (const a of areas) rows.push([s.locationId, s.locationName, a.areaCode, a.name]);
        }
        if (rows.length === 0) throw new Error("empty");
        return { source: "db", rows };
      } catch {
        return {
          source: "mock",
          rows: sites.flatMap((s) =>
            getAreasFor(s.locationId, s.locationName).map(
              (a) => [s.locationId, s.locationName, a.id, a.name] as (string | number)[],
            ),
          ),
        };
      }
    },
  },
  daily_sales: {
    header: ["trxDate", "projectCode", "locationId", "area", "status", "subtotal", "tax", "total", "isLate"],
    scope: "daily",
    load: (persona, filter) => loadDaily(persona, filter, "sales"),
  },
  daily_cost: {
    header: ["trxDate", "projectCode", "locationId", "area", "status", "subtotal", "tax", "total", "isLate"],
    scope: "daily",
    load: (persona, filter) => loadDaily(persona, filter, "cost"),
  },
};

async function loadDaily(
  persona: Persona,
  filter: DashboardFilter,
  kind: "sales" | "cost",
): Promise<Loaded> {
  try {
    const rows = (await listDailySubmissions(filter, kind, 1000)).filter((r) =>
      canAccessLocation(persona, r.locationId, r.projectId),
    );
    return {
      source: "db",
      rows: rows.map((r) => [
        r.trxDate,
        r.projectId,
        r.locationId,
        r.area ?? "",
        r.status,
        r.subtotal,
        r.tax,
        r.total,
        r.isLate ? "1" : "0",
      ]),
    };
  } catch {
    let sites = SITE_KPI.filter((s) => canAccessLocation(persona, s.locationId, s.projectCode));
    if (filter.projectId) sites = sites.filter((s) => s.projectCode === filter.projectId);
    if (filter.locationId) sites = sites.filter((s) => s.locationId === filter.locationId);
    const rows = sites.flatMap((s) => {
      const detail = SITE_DETAILS[s.locationId];
      if (!detail) return [] as (string | number)[][];
      return detail.daily30d
        .filter((d) => (!filter.from || d.iso >= filter.from) && (!filter.to || d.iso <= filter.to))
        .map((d) => {
          const value = kind === "sales" ? d.sales : d.cost;
          return [d.iso, s.projectCode, s.locationId, "", "approved", value, 0, value, "0"] as (
            | string
            | number
          )[];
        });
    });
    return { source: "mock", rows };
  }
}

/**
 * GET /api/import-export/export?module=&projectId=&locationId=&period=&from=&to=
 * Exports filtered data for a module as Excel-compatible CSV and records the
 * export in the job history. Requires an authenticated persona with export
 * rights; project-scoped modules also require a project the persona can access.
 */
export async function GET(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;
  if (!persona.capabilities.canExport) {
    return NextResponse.json({ error: "Persona ini tidak memiliki hak ekspor." }, { status: 403 });
  }

  const sp = req.nextUrl.searchParams;
  const moduleKey = sp.get("module") ?? "";
  const mod = MODULES[moduleKey];
  if (!mod) {
    return NextResponse.json(
      { error: `module tidak dikenal. Pilihan: ${Object.keys(MODULES).join(", ")}.` },
      { status: 400 },
    );
  }

  const projectId = sp.get("projectId") ?? undefined;
  if (mod.scope === "project" && !projectId) {
    return NextResponse.json({ error: "projectId wajib diisi untuk modul ini." }, { status: 400 });
  }
  if (projectId && !canAccessProject(persona, projectId)) {
    return NextResponse.json({ error: `Tidak ada akses ke project ${projectId}.` }, { status: 403 });
  }

  const period = parsePeriod(sp, undefined, projectId);
  const filter: DashboardFilter = {
    projectId,
    locationId: sp.get("locationId") ?? undefined,
    from: period.from,
    to: period.to,
    scope: projectId ? "tenant" : "executive",
  };

  let loaded: Loaded;
  try {
    loaded = await mod.load(persona, filter);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal memuat data ekspor." },
      { status: 400 },
    );
  }

  // Best-effort job history; never block the export if the DB is unavailable.
  try {
    await recordImportExportJob({
      direction: "export",
      entity: moduleKey,
      projectId,
      format: "csv",
      status: "completed",
      totalRows: loaded.rows.length,
      processedRows: loaded.rows.length,
      failedRows: 0,
      actor: persona.name,
      detail: `Ekspor ${moduleKey}: ${loaded.rows.length} baris.`,
      completedAt: new Date(),
    });
  } catch {
    // ignore — history is non-critical
  }

  const csv = toCsv([mod.header, ...loaded.rows]);
  const suffix = projectId ? `-${projectId}` : "";
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv;charset=utf-8",
      "Content-Disposition": `attachment; filename="export-${moduleKey}${suffix}.csv"`,
      "X-Data-Source": loaded.source,
    },
  });
}
