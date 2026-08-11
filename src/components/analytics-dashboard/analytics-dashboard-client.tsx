"use client";

import { useMemo } from "react";
import { BarChart3, TrendingUp, Wallet, Percent, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/common/kpi-card";
import { ProfitBySiteChart } from "@/components/margin/profit-by-site-chart";
import { usePersona } from "@/components/providers/persona-provider";
import { canAccessLocation } from "@/lib/personas";
import { SITE_KPI } from "@/lib/mock/site-kpi";
import { buildMarginBySite } from "@/lib/mock/margin-data";

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
