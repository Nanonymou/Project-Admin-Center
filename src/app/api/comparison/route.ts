import { NextResponse, type NextRequest } from "next/server";
import { requirePersona } from "@/lib/server/rbac";
import { canAccessLocation } from "@/lib/personas";
import { canViewComparison } from "@/lib/mock/access-config";
import { SITE_KPI, type SiteKpi } from "@/lib/mock/site-kpi";

export const dynamic = "force-dynamic";

type CompareRow = {
  key: string;
  label: string;
  sub: string;
  sales: number;
  cost: number;
  netMargin: number;
  marginPct: number;
  slaPct: number;
  siteCount: number;
};

/** Aggregate the scoped sites grouped by project. */
function aggregateByProject(sites: SiteKpi[]): CompareRow[] {
  const byProject = new Map<string, SiteKpi[]>();
  for (const s of sites) byProject.set(s.projectCode, [...(byProject.get(s.projectCode) ?? []), s]);

  return Array.from(byProject.entries())
    .map(([projectCode, group]) => {
      const sales = group.reduce((sum, x) => sum + x.sales, 0);
      const cost = group.reduce((sum, x) => sum + x.cost, 0);
      const slaPct = group.reduce((sum, x) => sum + x.slaPct, 0) / group.length;
      return {
        key: projectCode,
        label: group[0].projectName,
        sub: `${projectCode} · ${group.length} site`,
        sales,
        cost,
        netMargin: sales - cost,
        marginPct: sales > 0 ? ((sales - cost) / sales) * 100 : 0,
        slaPct,
        siteCount: group.length,
      };
    })
    .sort((a, b) => b.netMargin - a.netMargin);
}

/**
 * GET /api/comparison?mode=project
 *
 * Aggregated cross-project comparison data (sales / cost / net margin / margin% /
 * SLA per project) across the persona's accessible sites. Cross-site comparison
 * is a portfolio view, so it is restricted to Leader/Super Admin. Config-derived
 * from SITE_KPI. (Location mode is served by the same endpoint's later addition.)
 */
export async function GET(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;
  if (!canViewComparison(persona.role)) {
    return NextResponse.json({ error: "Perbandingan lintas site hanya untuk Leader/Super Admin." }, { status: 403 });
  }

  const sites = SITE_KPI.filter((s) => canAccessLocation(persona, s.locationId, s.projectCode));
  const rows = aggregateByProject(sites);

  const totals = {
    sales: rows.reduce((s, r) => s + r.sales, 0),
    cost: rows.reduce((s, r) => s + r.cost, 0),
    netMargin: rows.reduce((s, r) => s + r.netMargin, 0),
  };

  return NextResponse.json({ source: "config", mode: "project", count: rows.length, totals, rows });
}
