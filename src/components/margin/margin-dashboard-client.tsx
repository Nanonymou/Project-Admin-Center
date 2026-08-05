"use client";

import { useEffect, useMemo } from "react";
import { Download, Info, Lock, PiggyBank, RefreshCcw } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { ActivityFilterBar } from "@/components/activity/activity-filter-bar";
import { ActivePeriodBadge } from "@/components/common/active-period-badge";
import { KpiCard } from "@/components/common/kpi-card";
import { ProfitTrendChart } from "@/components/margin/profit-trend-chart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { usePersona } from "@/components/providers/persona-provider";
import { useGlobalFilters } from "@/components/providers/global-filter-provider";
import {
  aggregateTotals,
  daysBetween,
  scaleSiteKpisByPeriod,
  SITE_KPI,
} from "@/lib/mock/site-kpi";
import { buildMarginBySite, buildProfitTrend } from "@/lib/mock/margin-data";
import { LOCATION_OPTIONS, PROJECT_OPTIONS } from "@/lib/mock/filters";
import { canAccessLocation } from "@/lib/personas";
import { cn, formatCurrency } from "@/lib/utils";

export function MarginDashboardClient() {
  const { persona } = usePersona();
  const { filters, setFilters, reset } = useGlobalFilters();

  const scopedSites = useMemo(
    () => SITE_KPI.filter((s) => canAccessLocation(persona, s.locationId, s.projectCode)),
    [persona],
  );

  const personaProjectOptions = useMemo(
    () => PROJECT_OPTIONS.filter((p) => scopedSites.some((s) => s.projectCode === p.code)),
    [scopedSites],
  );
  const personaLocationOptions = useMemo(
    () => LOCATION_OPTIONS.filter((l) => scopedSites.some((s) => s.locationId === l.id)),
    [scopedSites],
  );

  useEffect(() => {
    const validProjects = new Set(personaProjectOptions.map((p) => p.code));
    const validLocations = new Set(personaLocationOptions.map((l) => l.id));
    const nextProjects = filters.projects.filter((p) => validProjects.has(p));
    const nextLocations = filters.locations.filter((l) => validLocations.has(l));
    if (
      nextProjects.length !== filters.projects.length ||
      nextLocations.length !== filters.locations.length
    ) {
      setFilters({ ...filters, projects: nextProjects, locations: nextLocations });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personaProjectOptions, personaLocationOptions]);

  const selectedLocationIds = useMemo(() => new Set(filters.locations), [filters.locations]);

  const filteredSites = useMemo(() => {
    const rows = scopedSites.filter((s) => {
      if (filters.projects.length > 0 && !filters.projects.includes(s.projectCode)) return false;
      if (filters.locations.length > 0 && !selectedLocationIds.has(s.locationId)) return false;
      return true;
    });
    return scaleSiteKpisByPeriod(rows, filters.from, filters.to);
  }, [scopedSites, filters.projects, filters.locations, filters.from, filters.to, selectedLocationIds]);

  const totals = useMemo(() => aggregateTotals(filteredSites), [filteredSites]);
  const trend = useMemo(() => buildProfitTrend(filteredSites), [filteredSites]);
  const bySite = useMemo(() => buildMarginBySite(filteredSites), [filteredSites]);
  const periodDays = daysBetween(filters.from, filters.to);

  const best = bySite[0];
  const worst = bySite[bySite.length - 1];
  const canExport = persona.capabilities.canExport;

  return (
    <div>
      <PageHeader
        title="Dashboard Margin"
        description="Analitik profit & margin lintas site — tren, kontribusi, dan performa per lokasi."
        breadcrumbs={[{ label: "Overview" }, { label: "Dashboard Margin" }]}
        actions={
          <>
            <ActivePeriodBadge />
            <Button variant="outline" size="sm">
              <RefreshCcw className="h-4 w-4" />
              Refresh
            </Button>
            <Button
              size="sm"
              disabled={!canExport}
              className={cn(!canExport && "cursor-not-allowed opacity-60")}
              title={canExport ? undefined : "Peran Anda tidak memiliki izin export"}
            >
              {canExport ? <Download className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
              Export
            </Button>
          </>
        }
      />

      <div className="space-y-6 p-4 md:p-6">
        <PersonaBanner persona={persona} scopeSummary={`${scopedSites.length} site accessible`} />

        <div className="flex items-start gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Nilai diskalakan ke periode <b>{filters.from} → {filters.to}</b> ({periodDays} hari).
            Tren 12 bulan bersifat indikatif.
          </span>
        </div>

        <ActivityFilterBar
          value={filters}
          onChange={setFilters}
          onReset={reset}
          matchedCount={filteredSites.length}
          projectOptions={personaProjectOptions}
          locationOptions={personaLocationOptions}
        />

        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiCard label="Total Profit" value={totals.netMargin} format="currency" icon={PiggyBank} tone="success" sub={`${totals.marginPct.toFixed(1)}% GP`} />
          <KpiCard label="Total Sales" value={totals.sales} format="currency" icon={PiggyBank} tone="primary" />
          <KpiCard label="Total Cost" value={totals.cost} format="currency" icon={PiggyBank} tone="warning" />
          <KpiCard label="Margin Rata-rata" value={totals.marginPct} format="percent" icon={PiggyBank} tone="info" />
        </section>

        <Card>
          <CardHeader>
            <CardTitle>Tren Profit & Margin (12 bulan)</CardTitle>
            <CardDescription>Area = profit, garis = sales/cost, garis ungu = margin % (aksis kanan).</CardDescription>
          </CardHeader>
          <CardContent>
            {filteredSites.length > 0 ? (
              <ProfitTrendChart data={trend} />
            ) : (
              <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">
                Tidak ada site dalam scope.
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Profit per Site</CardTitle>
              <CardDescription>Kontribusi profit bersih tiap lokasi.</CardDescription>
            </CardHeader>
            <CardContent>
              {bySite.length > 0 ? (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={bySite} margin={{ top: 8, right: 12, left: 8, bottom: 0 }} barCategoryGap={16}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 32% 91%)" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="hsl(215 16% 47%)" tickLine={false} axisLine={false} />
                      <YAxis
                        tick={{ fontSize: 10 }}
                        stroke="hsl(215 16% 47%)"
                        tickLine={false}
                        axisLine={false}
                        width={64}
                        tickFormatter={(v) => `${(v / 1_000_000_000).toFixed(1)}M`}
                      />
                      <Tooltip
                        contentStyle={{ borderRadius: 8, border: "1px solid hsl(214 32% 91%)", fontSize: 12 }}
                        formatter={(v: number) => formatCurrency(v)}
                      />
                      <Bar dataKey="profit" radius={[4, 4, 0, 0]}>
                        {bySite.map((s) => (
                          <Cell
                            key={s.locationId}
                            fill={
                              s.marginPct >= 55
                                ? "hsl(142 71% 45%)"
                                : s.marginPct >= 45
                                  ? "hsl(38 92% 50%)"
                                  : "hsl(0 84% 60%)"
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">
                  Tidak ada data.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Sorotan</CardTitle>
              <CardDescription>Performa margin tertinggi & terendah.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {best && (
                <Highlight label="Margin Tertinggi" tone="success" site={best.label} value={`${best.marginPct.toFixed(1)}%`} amount={formatCurrency(best.profit)} />
              )}
              {worst && worst !== best && (
                <Highlight label="Margin Terendah" tone="danger" site={worst.label} value={`${worst.marginPct.toFixed(1)}%`} amount={formatCurrency(worst.profit)} />
              )}
              {bySite.length === 0 && (
                <div className="py-8 text-center text-sm text-muted-foreground">Tidak ada data.</div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Highlight({
  label,
  tone,
  site,
  value,
  amount,
}: {
  label: string;
  tone: "success" | "danger";
  site: string;
  value: string;
  amount: string;
}) {
  return (
    <div
      className={cn(
        "rounded-md border p-3",
        tone === "success" ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50",
      )}
    >
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-semibold">{site}</div>
      <div className="mt-1 flex items-baseline justify-between">
        <span className="text-lg font-semibold tabular-nums">{value}</span>
        <span className="text-xs text-muted-foreground tabular-nums">{amount}</span>
      </div>
    </div>
  );
}
