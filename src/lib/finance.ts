import { getTaxConfig } from "@/lib/mock/tax-config";
import { formatCurrency, formatCurrencyCompact } from "@/lib/utils";

/**
 * Centralized, config-aware financial calculation helpers. Business rules
 * (Margin = Sales - Cost, Tax = Sales * rate, Net Invoice = Sales + Tax)
 * live here so pages/components never re-implement them inline.
 */

export function computeProfit(sales: number, cost: number): number {
  return sales - cost;
}

export function computeMarginPct(sales: number, cost: number): number {
  if (sales <= 0) return 0;
  return (computeProfit(sales, cost) / sales) * 100;
}

export function computeTax(sales: number, projectCode: string): number {
  const tax = getTaxConfig(projectCode);
  return Math.round(sales * tax.rate);
}

export function computeNetInvoice(sales: number, projectCode: string): number {
  return sales + computeTax(sales, projectCode);
}

export type ProfitBreakdown = {
  sales: number;
  cost: number;
  profit: number;
  marginPct: number;
  taxLabel: string;
  taxAmount: number;
  netInvoice: number;
};

export function computeProfitBreakdown(
  sales: number,
  cost: number,
  projectCode: string,
): ProfitBreakdown {
  const tax = getTaxConfig(projectCode);
  const taxAmount = Math.round(sales * tax.rate);
  return {
    sales,
    cost,
    profit: computeProfit(sales, cost),
    marginPct: computeMarginPct(sales, cost),
    taxLabel: tax.label,
    taxAmount,
    netInvoice: sales + taxAmount,
  };
}

/** Sum profit across many {sales,cost} rows. */
export function sumProfit(rows: { sales: number; cost: number }[]): number {
  return rows.reduce((total, r) => total + computeProfit(r.sales, r.cost), 0);
}

/** Weighted portfolio margin % (total profit / total sales). */
export function portfolioMarginPct(rows: { sales: number; cost: number }[]): number {
  const totalSales = rows.reduce((s, r) => s + r.sales, 0);
  const totalCost = rows.reduce((s, r) => s + r.cost, 0);
  return computeMarginPct(totalSales, totalCost);
}

/** Rupiah formatting — re-exported so consumers import from one place. */
export const formatRupiah = formatCurrency;
export const formatRupiahCompact = formatCurrencyCompact;
