import { NextResponse, type NextRequest } from "next/server";
import {
  listDailySubmissions,
  type DashboardFilter,
} from "@/db/repositories/daily-transaction-repository";
import { authorizeDashboard, requirePersona } from "@/lib/server/rbac";
import { parsePeriod } from "@/lib/server/period";
import { canAccessLocation } from "@/lib/personas";
import { SITE_KPI } from "@/lib/mock/site-kpi";
import { SITE_DETAILS } from "@/lib/mock/site-detail";

export const dynamic = "force-dynamic";

/**
 * GET /api/daily-cost/history?projectId=&locationId=&period=&from=&to=&limit=&scope=
 * Daily-cost submission history across the sites the persona may see, newest
 * first. Cross-site (executive) access is restricted to Leader/Super Admin.
 * Falls back to mock per-day cost history when the database is unavailable.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const projectId = sp.get("projectId") ?? undefined;
  const period = parsePeriod(sp, undefined, projectId);
  const limitRaw = Number(sp.get("limit"));
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : 200;
  const scope = (sp.get("scope") as "tenant" | "executive" | null) ?? (projectId ? "tenant" : "executive");
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
    const rows = (await listDailySubmissions(filter, "cost", limit)).filter((r) =>
      canAccessLocation(persona, r.locationId, r.projectId),
    );
    const history = rows.map((r) => ({
      id: r.id,
      projectCode: r.projectId,
      locationId: r.locationId,
      trxDate: r.trxDate,
      area: r.area,
      status: r.status,
      total: Number(r.total),
      isLate: r.isLate,
      submittedAt: r.submittedAt,
      submittedBy: r.submittedBy,
    }));
    return NextResponse.json({ source: "db", filter, count: history.length, history });
  } catch {
    let sites = SITE_KPI.filter((s) => canAccessLocation(persona, s.locationId, s.projectCode));
    if (projectId) sites = sites.filter((s) => s.projectCode === projectId);
    if (filter.locationId) sites = sites.filter((s) => s.locationId === filter.locationId);

    const history = sites
      .flatMap((s) => {
        const detail = SITE_DETAILS[s.locationId];
        if (!detail) return [];
        return detail.daily30d
          .filter((d) => (!filter.from || d.iso >= filter.from) && (!filter.to || d.iso <= filter.to))
          .map((d) => ({
            id: `${s.locationId}-${d.iso}`,
            projectCode: s.projectCode,
            locationId: s.locationId,
            trxDate: d.iso,
            status: "approved",
            total: d.cost,
            isLate: false,
          }));
      })
      .sort((a, b) => (a.trxDate < b.trxDate ? 1 : -1))
      .slice(0, limit);

    return NextResponse.json({ source: "mock", filter, count: history.length, history });
  }
}
