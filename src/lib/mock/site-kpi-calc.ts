import type { MockInvoice, SiteDaily, SiteDetail } from "./site-detail";
import { getTaxConfig } from "./tax-config";

export type ComputedSiteKpi = {
  // Volume / financial (period-scoped)
  grossSales: number;
  totalCost: number;
  netMargin: number;
  marginPct: number;
  taxCode: string;
  taxLabel: string;
  taxAmount: number;
  netInvoiceValue: number; // gross + tax
  avgDailySales: number;
  activeDays: number;
  // Operational
  transactionCount: number;
  slaPct: number;
  pendingApprovals: number;
  overdueInvoices: number;
  outstandingCount: number;
  outstandingAmount: number;
};

function withinRange(iso: string, from: string, to: string) {
  return iso >= from && iso <= to;
}

/**
 * Compute site KPIs from raw daily + invoice mock data, applying the
 * project's tax configuration. This keeps the formulas (Margin = Sales -
 * Cost, Tax = Sales * rate, Net Invoice = Sales + Tax) in one place and
 * driven by config rather than hardcoded per project.
 */
export function computeSiteKpi(
  detail: SiteDetail,
  period: { from: string; to: string },
): ComputedSiteKpi {
  const site = detail.site;
  const tax = getTaxConfig(site.projectCode);

  const dailyInRange: SiteDaily[] = detail.daily30d.filter((d) =>
    withinRange(d.iso, period.from, period.to),
  );

  const grossSales = dailyInRange.reduce((s, d) => s + d.sales, 0);
  const totalCost = dailyInRange.reduce((s, d) => s + d.cost, 0);
  const netMargin = grossSales - totalCost;
  const marginPct = grossSales === 0 ? 0 : (netMargin / grossSales) * 100;
  const taxAmount = Math.round(grossSales * tax.rate);
  const netInvoiceValue = grossSales + taxAmount;
  const activeDays = dailyInRange.length;
  const avgDailySales = activeDays === 0 ? 0 : Math.round(grossSales / activeDays);

  // Scale count-based operational metrics to the period length.
  const factor = detail.daily30d.length === 0 ? 1 : activeDays / detail.daily30d.length;
  const transactionCount = Math.round((detail.invoices.length || 0) * Math.max(0.05, factor) * 20);

  const outstanding: MockInvoice[] = detail.invoices.filter(
    (inv) => inv.stage !== "Payment" || inv.status === "overdue",
  );
  const outstandingAmount = outstanding.reduce((s, inv) => s + inv.amount, 0);

  return {
    grossSales,
    totalCost,
    netMargin,
    marginPct,
    taxCode: tax.code,
    taxLabel: tax.label,
    taxAmount,
    netInvoiceValue,
    avgDailySales,
    activeDays,
    transactionCount,
    slaPct: site.slaPct,
    pendingApprovals: site.pendingApprovals,
    overdueInvoices: site.overdueInvoices,
    outstandingCount: Math.round(outstanding.length * Math.max(0.05, factor)),
    outstandingAmount: Math.round(outstandingAmount * Math.max(0.05, factor)),
  };
}
