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
import { InvoiceTrendChart, buildInvoiceTrend } from "@/components/analytics-dashboard/invoice-trend-chart";
import { ApprovalTrendChart, buildApprovalTrend } from "@/components/analytics-dashboard/approval-trend-chart";
import { FileText, BadgeCheck, CalendarRange, ArrowUp, ArrowDown } from "lucide-react";
import { formatCurrencyCompact } from "@/lib/utils";
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

  const invoiceTrend = useMemo(() => buildInvoiceTrend(totals.sales), [totals.sales]);

  const pendingTotal = useMemo(
    () => scopedSites.reduce((s, x) => s + x.pendingApprovals, 0),
    [scopedSites],
  );
  const approvalTrend = useMemo(() => buildApprovalTrend(pendingTotal + scopedSites.length * 4), [pendingTotal, scopedSites.length]);

  // Current vs previous period comparison (month-over-month), aggregated from
  // each site's prevPeriod snapshot.
  const monthly = useMemo(() => {
    const withPrev = scopedSites.filter((s) => s.prevPeriod);
    const curSales = withPrev.reduce((s, x) => s + x.sales, 0);
    const prevSales = withPrev.reduce((s, x) => s + (x.prevPeriod?.sales ?? 0), 0);
    const curMargin = withPrev.length ? withPrev.reduce((s, x) => s + x.marginPct, 0) / withPrev.length : 0;
    const prevMargin = withPrev.length
      ? withPrev.reduce((s, x) => s + (x.prevPeriod?.marginPct ?? 0), 0) / withPrev.length
      : 0;
    const curSla = withPrev.length ? withPrev.reduce((s, x) => s + x.slaPct, 0) / withPrev.length : 0;
    const prevSla = withPrev.length
      ? withPrev.reduce((s, x) => s + (x.prevPeriod?.slaPct ?? 0), 0) / withPrev.length
      : 0;
    return { curSales, prevSales, curMargin, prevMargin, curSla, prevSla, hasData: withPrev.length > 0 };
  }, [scopedSites]);

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

      {monthly.hasData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarRange className="h-5 w-5" />
              Perbandingan Bulanan
            </CardTitle>
            <CardDescription>Periode berjalan vs periode sebelumnya.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <MonthlyCompareRow label="Sales" current={monthly.curSales} previous={monthly.prevSales} format="currency" />
            <MonthlyCompareRow label="Margin %" current={monthly.curMargin} previous={monthly.prevMargin} format="pp" />
            <MonthlyCompareRow label="SLA %" current={monthly.curSla} previous={monthly.prevSla} format="pp" />
          </CardContent>
        </Card>
      )}

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
            <BadgeCheck className="h-5 w-5" />
            Approval Trend (6 minggu)
          </CardTitle>
          <CardDescription>Jumlah approval disetujui vs pending per minggu.</CardDescription>
        </CardHeader>
        <CardContent>
          <ApprovalTrendChart data={approvalTrend} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Invoice Trend (6 bulan)
          </CardTitle>
          <CardDescription>Nilai invoice diterbitkan vs dibayar per bulan.</CardDescription>
        </CardHeader>
        <CardContent>
          <InvoiceTrendChart data={invoiceTrend} />
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

function MonthlyCompareRow({
  label,
  current,
  previous,
  format,
}: {
  label: string;
  current: number;
  previous: number;
  format: "currency" | "pp";
}) {
  const fmt = (v: number) => (format === "currency" ? formatCurrencyCompact(v) : `${v.toFixed(1)}%`);
  // Delta: percent change for currency, percentage-point change for pp metrics.
  const delta = format === "currency" ? (previous > 0 ? ((current - previous) / previous) * 100 : 0) : current - previous;
  const up = delta >= 0;
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">{fmt(current)}</p>
      <div className="mt-1 flex items-center gap-2 text-xs">
        <span className={up ? "inline-flex items-center gap-0.5 text-emerald-600" : "inline-flex items-center gap-0.5 text-rose-600"}>
          {up ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
          {format === "currency" ? `${Math.abs(delta).toFixed(1)}%` : `${Math.abs(delta).toFixed(1)} pp`}
        </span>
        <span className="text-muted-foreground">dari {fmt(previous)}</span>
      </div>
    </div>
  );
}
