import { NextResponse, type NextRequest } from "next/server";
import {
  aggregateByPeriod,
  aggregateSalesCostBySite,
  type DashboardFilter,
} from "@/db/repositories/daily-transaction-repository";
import { aggregateOutstanding, type InvoiceFilter } from "@/db/repositories/invoice-repository";
import { buildKpiSummary } from "@/lib/server/services/kpi-summary-service";
import { computeKpiStatus, computeMonthlyTotals } from "@/lib/server/services/kpi-status-service";
import { authorizeDashboard, getPersonaFromHeaders } from "@/lib/server/rbac";
import { parsePeriod } from "@/lib/server/period";
import { canAccessLocation } from "@/lib/personas";
import { getMarginTarget } from "@/lib/mock/margin-model";
import { SITE_KPI, scaleSiteKpisByPeriod } from "@/lib/mock/site-kpi";
import { SITE_DETAILS } from "@/lib/mock/site-detail";
import { buildOutstandingInvoicesFor } from "@/lib/mock/outstanding";
import { buildProfitTrendForRange } from "@/lib/mock/margin-data";

export const dynamic = "force-dynamic";

/**
 * GET /api/kpi/summary?projectId=&locationId=&period=&from=&to=&scope=
 * Headline KPI summary for the "KPI Utama Site" widget: sales, cost, gross
 * profit, margin %, plus outstanding/overdue invoice totals — scoped to the
 * persona. Falls back to mock aggregation when the database is unavailable.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const projectId = sp.get("projectId") ?? undefined;
  const locationId = sp.get("locationId") ?? undefined;
  const period = parsePeriod(sp, undefined, projectId);
  const scope = (sp.get("scope") as "tenant" | "executive" | null) ?? (projectId ? "tenant" : "executive");
  const filter: DashboardFilter = { projectId, locationId, from: period.from, to: period.to, scope };

  const persona = getPersonaFromHeaders(req.headers);
  const authz = authorizeDashboard(persona, filter);
  if (!authz.ok) {
    return NextResponse.json({ error: authz.message, role: persona.role }, { status: authz.status });
  }

  const target = getMarginTarget(projectId);

  try {
    const sites = (await aggregateSalesCostBySite(filter)).filter((s) =>
      canAccessLocation(persona, s.locationId, s.projectId),
    );
    const invoiceFilter: InvoiceFilter = { projectId, locationId, scope };
    const outstanding = await aggregateOutstanding(invoiceFilter);
    const summary = buildKpiSummary(sites, outstanding);
    const monthly = computeMonthlyTotals(await aggregateByPeriod(filter, "month"));
    return NextResponse.json({
      source: "db",
      filter,
      target,
      status: computeKpiStatus(summary.marginPct, target),
      summary,
      monthly,
    });
  } catch {
    let rows = SITE_KPI.filter((s) => canAccessLocation(persona, s.locationId, s.projectCode));
    if (projectId) rows = rows.filter((r) => r.projectCode === projectId);
    if (locationId) rows = rows.filter((r) => r.locationId === locationId);
    if (filter.from && filter.to) rows = scaleSiteKpisByPeriod(rows, filter.from, filter.to);

    const sites = rows.map((r) => ({
      projectId: r.projectCode,
      locationId: r.locationId,
      sales: r.sales,
      cost: r.cost,
      profit: r.sales - r.cost,
      transactions: 0,
    }));

    const outstandingItems = buildOutstandingInvoicesFor(rows, SITE_DETAILS);
    const overdueItems = outstandingItems.filter((i) => i.status === "overdue");
    const outstanding = {
      outstandingCount: outstandingItems.length,
      outstandingAmount: outstandingItems.reduce((s, i) => s + i.amount, 0),
      overdueCount: overdueItems.length,
      overdueAmount: overdueItems.reduce((s, i) => s + i.amount, 0),
    };

    const summary = buildKpiSummary(sites, outstanding);
    const from = filter.from ?? new Date(Date.now() - 180 * 86_400_000).toISOString().slice(0, 10);
    const to = filter.to ?? new Date().toISOString().slice(0, 10);
    const monthly = computeMonthlyTotals(
      buildProfitTrendForRange(rows, from, to).map((p) => ({
        period: p.month,
        sales: p.sales,
        cost: p.cost,
        profit: p.profit,
      })),
    );
    return NextResponse.json({
      source: "mock",
      filter,
      target,
      status: computeKpiStatus(summary.marginPct, target),
      summary,
      monthly,
    });
  }
}
