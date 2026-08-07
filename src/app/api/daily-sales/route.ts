import { NextResponse, type NextRequest } from "next/server";
import {
  createDailySubmission,
  listDailySubmissions,
  type DailyTransactionStatusValue,
  type DashboardFilter,
} from "@/db/repositories/daily-transaction-repository";
import { isPeriodLocked } from "@/db/repositories/lock-period-repository";
import { authorizeDashboard, requirePersona } from "@/lib/server/rbac";
import { revalidateKpi } from "@/lib/server/kpi-cache";
import { validatePeriodInput } from "@/lib/server/guards/period-input-guard";
import { parsePeriod } from "@/lib/server/period";
import { canAccessLocation } from "@/lib/personas";
import { SITE_KPI } from "@/lib/mock/site-kpi";
import { SITE_DETAILS } from "@/lib/mock/site-detail";
import { prepareDailySalesSubmission } from "@/lib/server/services/daily-sales-submission-service";
import type { SalesEntryInput } from "@/lib/mock/service-config";

export const dynamic = "force-dynamic";

/**
 * GET /api/daily-sales?projectId=&locationId=&period=&from=&to=&limit=&scope=
 * Lists daily-sales entries across the sites the persona may see, newest first.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const projectId = sp.get("projectId") ?? undefined;
  const period = parsePeriod(sp, undefined, projectId);
  const limitRaw = Number(sp.get("limit"));
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : 200;
  const scope = (sp.get("scope") as "tenant" | "executive" | null) ?? (projectId ? "tenant" : "executive");
  // Lock/status filter and multi-site selection.
  const STATUSES = ["draft", "submitted", "approved", "locked"] as const;
  const statusRaw = sp.get("status");
  const status = STATUSES.includes(statusRaw as DailyTransactionStatusValue)
    ? (statusRaw as DailyTransactionStatusValue)
    : undefined;
  const siteSet = new Set(
    (sp.get("sites") ?? "").split(",").map((s) => s.trim()).filter(Boolean),
  );
  const inSiteSet = (locationId: string) => siteSet.size === 0 || siteSet.has(locationId);
  const filter: DashboardFilter = {
    projectId,
    locationId: sp.get("locationId") ?? undefined,
    from: period.from,
    to: period.to,
    scope,
  };

  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;
  const authz = authorizeDashboard(persona, filter);
  if (!authz.ok) {
    return NextResponse.json({ error: authz.message, role: persona.role }, { status: authz.status });
  }

  try {
    const rows = (await listDailySubmissions(filter, "sales", limit, status)).filter(
      (r) => canAccessLocation(persona, r.locationId, r.projectId) && inSiteSet(r.locationId),
    );
    const entries = rows.map((r) => ({ ...r, locked: r.status === "locked" }));
    return NextResponse.json({ source: "db", filter, status, count: entries.length, entries });
  } catch {
    let sites = SITE_KPI.filter((s) => canAccessLocation(persona, s.locationId, s.projectCode));
    if (projectId) sites = sites.filter((s) => s.projectCode === projectId);
    if (filter.locationId) sites = sites.filter((s) => s.locationId === filter.locationId);
    sites = sites.filter((s) => inSiteSet(s.locationId));
    let entries = sites.flatMap((s) => {
      const detail = SITE_DETAILS[s.locationId];
      if (!detail) return [];
      return detail.daily30d
        .filter((d) => (!filter.from || d.iso >= filter.from) && (!filter.to || d.iso <= filter.to))
        .map((d) => ({
          id: `${s.locationId}-${d.iso}`,
          projectCode: s.projectCode,
          locationId: s.locationId,
          trxDate: d.iso,
          status: "approved" as const,
          total: d.sales,
        }));
    });
    // Lock/status filter applied to the synthesized mock rows (all "approved").
    if (status) entries = entries.filter((e) => e.status === status);
    return NextResponse.json({ source: "mock", filter, status, count: entries.length, entries });
  }
}

/**
 * POST /api/daily-sales
 * Body: { projectId, locationId, trxDate, area?, values: { key: { qty, price } } }
 * Creates a daily-sales entry after dynamic validation. Viewers cannot submit;
 * the persona must have access to the target site.
 */
export async function POST(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;
  if (persona.role === "viewer") {
    return NextResponse.json({ error: "Viewer tidak dapat submit daily sales." }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Body JSON tidak valid." }, { status: 400 });
  }

  const projectId = typeof body.projectId === "string" ? body.projectId : "";
  const locationId = typeof body.locationId === "string" ? body.locationId : "";
  const trxDate = typeof body.trxDate === "string" ? body.trxDate : "";
  const area = typeof body.area === "string" ? body.area : undefined;
  const areaId = typeof body.areaId === "string" ? body.areaId : undefined;
  const values = (body.values && typeof body.values === "object" ? body.values : {}) as SalesEntryInput;

  if (!projectId || !locationId || !trxDate) {
    return NextResponse.json({ error: "projectId, locationId, dan trxDate wajib diisi." }, { status: 400 });
  }

  const authz = authorizeDashboard(persona, { projectId, locationId, scope: "tenant" });
  if (!authz.ok) {
    return NextResponse.json({ error: authz.message, role: persona.role }, { status: authz.status });
  }
  if (!canAccessLocation(persona, locationId, projectId)) {
    return NextResponse.json({ error: `Tidak ada akses ke lokasi ${locationId}.` }, { status: 403 });
  }

  const prepared = prepareDailySalesSubmission({
    projectId,
    locationId,
    trxDate,
    area,
    areaId,
    values,
    submittedBy: persona.name,
  });
  if (!prepared.ok) {
    return NextResponse.json({ error: "Validasi gagal.", errors: prepared.errors }, { status: 422 });
  }

  // H+1 / cut-off period-input guard.
  const periodCheck = validatePeriodInput(projectId, prepared.input.trxDate);
  if (!periodCheck.ok) {
    return NextResponse.json({ error: periodCheck.error }, { status: periodCheck.status });
  }

  try {
    if (await isPeriodLocked(projectId, locationId, prepared.input.trxDate)) {
      return NextResponse.json(
        { error: "Periode terkunci — entri tidak dapat disimpan." },
        { status: 409 },
      );
    }
    const header = await createDailySubmission(prepared.input);
    revalidateKpi();
    return NextResponse.json({ source: "db", entry: header, isLate: prepared.isLate }, { status: 201 });
  } catch (err) {
    revalidateKpi();
    return NextResponse.json({
      source: "mock",
      simulated: true,
      message: "Daily sales dicatat secara simulasi (database tidak tersedia).",
      detail: err instanceof Error ? err.message : String(err),
      entry: prepared.input,
      isLate: prepared.isLate,
    });
  }
}
