import { NextResponse, type NextRequest } from "next/server";
import {
  listDailySubmissions,
  type DailyTransactionStatusValue,
  type DashboardFilter,
} from "@/db/repositories/daily-transaction-repository";
import { authorizeDashboard, requirePersona } from "@/lib/server/rbac";
import { parsePeriod } from "@/lib/server/period";
import { canAccessLocation } from "@/lib/personas";
import { SITE_KPI } from "@/lib/mock/site-kpi";
import { SITE_DETAILS } from "@/lib/mock/site-detail";

export const dynamic = "force-dynamic";

/**
 * GET /api/daily-cost?projectId=&locationId=&status=&period=&from=&to=&limit=&scope=
 * Lists daily-cost entries across the sites the persona may see, newest first.
 * (Create is POST /api/daily-cost/submit; item ops are /api/daily-cost/:id.)
 * Falls back to mock per-day cost data when the database is unavailable.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const projectId = sp.get("projectId") ?? undefined;
  const period = parsePeriod(sp, undefined, projectId);
  const limitRaw = Number(sp.get("limit"));
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : 200;
  const scope = (sp.get("scope") as "tenant" | "executive" | null) ?? (projectId ? "tenant" : "executive");
  const STATUSES = ["draft", "submitted", "approved", "locked"] as const;
  const statusRaw = sp.get("status");
  const status = STATUSES.includes(statusRaw as DailyTransactionStatusValue)
    ? (statusRaw as DailyTransactionStatusValue)
    : undefined;
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
    const rows = (await listDailySubmissions(filter, "cost", limit, status)).filter((r) =>
      canAccessLocation(persona, r.locationId, r.projectId),
    );
    const entries = rows.map((r) => ({ ...r, locked: r.status === "locked" }));
    return NextResponse.json({ source: "db", filter, status, count: entries.length, entries });
  } catch {
    let sites = SITE_KPI.filter((s) => canAccessLocation(persona, s.locationId, s.projectCode));
    if (projectId) sites = sites.filter((s) => s.projectCode === projectId);
    if (filter.locationId) sites = sites.filter((s) => s.locationId === filter.locationId);
    const entries = sites.flatMap((s) => {
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
          total: d.cost,
          locked: false,
        }));
    });
    return NextResponse.json({ source: "mock", filter, status, count: entries.length, entries });
  }
}
