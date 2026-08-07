import { NextResponse, type NextRequest } from "next/server";
import { listDailySubmissions, type DashboardFilter } from "@/db/repositories/daily-transaction-repository";
import { authorizeDashboard, requirePersona } from "@/lib/server/rbac";
import { parsePeriod } from "@/lib/server/period";
import { canAccessLocation } from "@/lib/personas";
import { SITE_KPI } from "@/lib/mock/site-kpi";
import { SITE_DETAILS } from "@/lib/mock/site-detail";
import { toCsv } from "@/lib/csv";

export const dynamic = "force-dynamic";

const HEADER = ["trxDate", "projectCode", "locationId", "area", "status", "subtotal", "tax", "total", "isLate"];

/**
 * GET /api/daily-sales/export?projectId=&locationId=&period=&from=&to=&scope=
 * Exports daily-sales entries as Excel-compatible CSV for the sites the persona
 * may see. Falls back to mock per-day data when the database is unavailable.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const projectId = sp.get("projectId") ?? undefined;
  const period = parsePeriod(sp, undefined, projectId);
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

  let dataRows: (string | number)[][];
  try {
    const rows = (await listDailySubmissions(filter, "sales", 1000)).filter((r) =>
      canAccessLocation(persona, r.locationId, r.projectId),
    );
    dataRows = rows.map((r) => [
      r.trxDate,
      r.projectId,
      r.locationId,
      r.area ?? "",
      r.status,
      r.subtotal,
      r.tax,
      r.total,
      r.isLate ? "1" : "0",
    ]);
  } catch {
    let sites = SITE_KPI.filter((s) => canAccessLocation(persona, s.locationId, s.projectCode));
    if (projectId) sites = sites.filter((s) => s.projectCode === projectId);
    if (filter.locationId) sites = sites.filter((s) => s.locationId === filter.locationId);
    dataRows = sites.flatMap((s) => {
      const detail = SITE_DETAILS[s.locationId];
      if (!detail) return [];
      return detail.daily30d
        .filter((d) => (!filter.from || d.iso >= filter.from) && (!filter.to || d.iso <= filter.to))
        .map((d) => [d.iso, s.projectCode, s.locationId, "", "approved", d.sales, 0, d.sales, "0"]);
    });
  }

  const csv = toCsv([HEADER, ...dataRows]);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv;charset=utf-8",
      "Content-Disposition": 'attachment; filename="daily-sales.csv"',
    },
  });
}
