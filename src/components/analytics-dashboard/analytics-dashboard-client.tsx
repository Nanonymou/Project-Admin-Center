"use client";

import { useMemo } from "react";
import { BarChart3, TrendingUp, Wallet, Percent, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/common/kpi-card";
import { ProfitBySiteChart } from "@/components/margin/profit-by-site-chart";
import { SalesCostChart } from "@/components/site/sales-cost-chart";
import { CostTrendChart } from "@/components/analytics-dashboard/cost-trend-chart";
import { ProfitTrendChart, type ProfitTrendPoint } from "@/components/margin/profit-trend-chart";
import { usePersona } from "@/components/providers/persona-provider";
import { canAccessLocation } from "@/lib/personas";
import { SITE_KPI } from "@/lib/mock/site-kpi";
import { buildMarginBySite } from "@/lib/mock/margin-data";
import type { SiteDaily } from "@/lib/mock/site-detail";

/**
 * Analytics Dashboard — the main analytics landing: portfolio KPI summary across
 * the sites a persona can see, plus a profit-by-site breakdown. This task lays
 * out the primary shell (header, KPI row, and the first chart); later tasks add
 * trend, comparison, and drill-down widgets. Persona-scoped, frontend-first
 * (aggregated from SITE_KPI), no backend required.
 */
export function AnalyticsDashboardClient() {
  const { persona } = usePersona();

  const scopedSites = useMemo(
    () => SITE_KPI.filter((s) => canAccessLocation(persona, s.locationId, s.projectCode)),
    [persona],
  );

  const totals = useMemo(() => {
    const sales = scopedSites.reduce((s, x) => s + x.sales, 0);
    const cost = scopedSites.reduce((s, x) => s + x.cost, 0);
    const netMargin = sales - cost;
    const marginPct = sales > 0 ? (netMargin / sales) * 100 : 0;
    const slaPct =
      scopedSites.length > 0 ? scopedSites.reduce((s, x) => s + x.slaPct, 0) / scopedSites.length : 0;
    return { sales, cost, netMargin, marginPct, slaPct };
  }, [scopedSites]);

  const marginBySite = useMemo(() => buildMarginBySite(scopedSites), [scopedSites]);

  // Aggregate the 7-day sales/cost trend across every scoped site into the daily
  // series the shared SalesCostChart consumes.
  const salesTrend = useMemo<SiteDaily[]>(() => {
    const byDay = new Map<string, { sales: number; cost: number }>();
    const order: string[] = [];
    for (const site of scopedSites) {
      for (const p of site.trend7d) {
        if (!byDay.has(p.day)) {
          byDay.set(p.day, { sales: 0, cost: 0 });
          order.push(p.day);
        }
        const acc = byDay.get(p.day)!;
        acc.sales += p.sales;
        acc.cost += p.cost;
      }
    }
    const today = new Date();
    return order.map((day, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - (order.length - 1 - i));
      const agg = byDay.get(day)!;
      return { date: day, iso: d.toISOString().slice(0, 10), sales: agg.sales, cost: agg.cost };
    });
  }, [scopedSites]);

  const profitTrend = useMemo<ProfitTrendPoint[]>(
    () =>
      salesTrend.map((d) => {
        const profit = d.sales - d.cost;
        return {
          month: d.date,
          sales: d.sales,
          cost: d.cost,
          profit,
          marginPct: d.sales > 0 ? (profit / d.sales) * 100 : 0,
        };
      }),
    [salesTrend],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics Dashboard"
        description="Ringkasan analitik portofolio — penjualan, biaya, margin, dan kepatuhan SLA lintas site dalam cakupan Anda."
      />
      <PersonaBanner persona={persona} scopeSummary={`${scopedSites.length} site accessible`} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <KpiCard label="Total Sales" value={totals.sales} format="currency-compact" icon={TrendingUp} tone="info" />
        <KpiCard label="Total Cost" value={totals.cost} format="currency-compact" icon={Wallet} tone="warning" />
        <KpiCard label="Net Margin" value={totals.netMargin} format="currency-compact" icon={BarChart3} tone="success" />
        <KpiCard label="Margin %" value={totals.marginPct} format="percent" icon={Percent} tone="success" />
        <KpiCard label="Rata-rata SLA" value={totals.slaPct} format="percent" icon={ShieldCheck} tone="info" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Sales Trend (7 hari)
          </CardTitle>
          <CardDescription>Agregat penjualan & biaya harian lintas site dalam cakupan Anda.</CardDescription>
        </CardHeader>
        <CardContent>
          {salesTrend.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Tidak ada data tren pada cakupan Anda.</p>
          ) : (
            <SalesCostChart data={salesTrend} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Profit Trend (7 hari)
          </CardTitle>
          <CardDescription>Profit harian agregat dengan margin % lintas site.</CardDescription>
        </CardHeader>
        <CardContent>
          {profitTrend.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Tidak ada data tren pada cakupan Anda.</p>
          ) : (
            <ProfitTrendChart data={profitTrend} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Cost Trend (7 hari)
          </CardTitle>
          <CardDescription>Biaya harian agregat dan rasio biaya terhadap penjualan.</CardDescription>
        </CardHeader>
        <CardContent>
          <CostTrendChart data={salesTrend} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Profit per Site
          </CardTitle>
          <CardDescription>Perbandingan profit, margin, dan penjualan antar site.</CardDescription>
        </CardHeader>
        <CardContent>
          {marginBySite.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Tidak ada data pada cakupan Anda.</p>
          ) : (
            <ProfitBySiteChart data={marginBySite} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
