"use client";

import { PiggyBank, Receipt, ShoppingCart, Wallet } from "lucide-react";
import { KpiCard } from "@/components/common/kpi-card";
import type { SiteKpi } from "@/lib/mock/site-kpi";
import { portfolioMarginPct } from "@/lib/finance";

export type MarginSummary = {
  sales: number;
  cost: number;
  profit: number;
  marginPct: number;
  prevProfit?: number;
  prevMarginPct?: number;
};

export function summarizeMargin(sites: SiteKpi[]): MarginSummary {
  const sales = sites.reduce((s, x) => s + x.sales, 0);
  const cost = sites.reduce((s, x) => s + x.cost, 0);
  const profit = sales - cost;
  const prevSales = sites.reduce((s, x) => s + (x.prevPeriod?.sales ?? x.sales), 0);
  const prevProfit = prevSales - cost * 0.98; // indicative
  return {
    sales,
    cost,
    profit,
    marginPct: portfolioMarginPct(sites.map((s) => ({ sales: s.sales, cost: s.cost }))),
    prevProfit,
    prevMarginPct:
      sites.length === 0
        ? undefined
        : sites.reduce((s, x) => s + (x.prevPeriod?.marginPct ?? x.marginPct), 0) / sites.length,
  };
}

/**
 * Reusable margin summary KPI row: Sales, Cost, Profit (+ delta), Margin %.
 */
export function MarginSummaryCards({ summary }: { summary: MarginSummary }) {
  const profitDelta =
    summary.prevProfit && summary.prevProfit !== 0
      ? ((summary.profit - summary.prevProfit) / Math.abs(summary.prevProfit)) * 100
      : undefined;
  const marginDelta =
    summary.prevMarginPct !== undefined ? summary.marginPct - summary.prevMarginPct : undefined;

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <KpiCard label="Total Sales" value={summary.sales} format="currency" icon={ShoppingCart} tone="primary" />
      <KpiCard label="Total Cost" value={summary.cost} format="currency" icon={Wallet} tone="warning" />
      <KpiCard
        label="Net Profit"
        value={summary.profit}
        format="currency"
        icon={PiggyBank}
        tone="success"
        delta={profitDelta}
        deltaSuffix="%"
        deltaLabel="vs periode lalu"
      />
      <KpiCard
        label="Margin %"
        value={summary.marginPct}
        format="percent"
        icon={Receipt}
        tone="info"
        delta={marginDelta}
        deltaLabel="poin margin"
      />
    </div>
  );
}
