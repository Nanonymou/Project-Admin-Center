"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Download, Info, Lock, RefreshCcw, ShoppingCart } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { ActivityFilterBar } from "@/components/activity/activity-filter-bar";
import { ActivePeriodBadge } from "@/components/common/active-period-badge";
import { KpiCard } from "@/components/common/kpi-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SalesCompareBar } from "@/components/sales-compare/sales-compare-bar";
import { usePersona } from "@/components/providers/persona-provider";
import { useGlobalFilters } from "@/components/providers/global-filter-provider";
import { daysBetween, scaleSiteKpisByPeriod, SITE_KPI } from "@/lib/mock/site-kpi";
import { buildProfitTrendForRange, buildSalesByProject } from "@/lib/mock/margin-data";
import { LOCATION_OPTIONS, PROJECT_OPTIONS } from "@/lib/mock/filters";
import { canAccessLocation } from "@/lib/personas";
import { cn, formatCurrency } from "@/lib/utils";

export function SalesCompareClient() {
  const { persona } = usePersona();
  const { filters, setFilters, reset } = useGlobalFilters();
  const [dimension, setDimension] = useState<"site" | "project">("site");

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
    const vp = new Set(personaProjectOptions.map((p) => p.code));
    const vl = new Set(personaLocationOptions.map((l) => l.id));
    const np = filters.projects.filter((p) => vp.has(p));
    const nl = filters.locations.filter((l) => vl.has(l));
    if (np.length !== filters.projects.length || nl.length !== filters.locations.length) {
      setFilters({ ...filters, projects: np, locations: nl });
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

  const bySite = useMemo(
    () =>
      [...filteredSites]
        .sort((a, b) => b.sales - a.sales)
        .map((s) => ({
          label: `${s.projectCode} · ${s.locationName}`,
          sales: s.sales,
          prevSales: s.prevPeriod?.sales,
          key: s.locationId,
        })),
    [filteredSites],
  );
  const byProject = useMemo(() => buildSalesByProject(filteredSites), [filteredSites]);
  const trend = useMemo(
    () => buildProfitTrendForRange(filteredSites, filters.from, filters.to),
    [filteredSites, filters.from, filters.to],
  );

  const totalSales = filteredSites.reduce((s, x) => s + x.sales, 0);
  const avgPerSite = filteredSites.length ? totalSales / filteredSites.length : 0;
  const topSite = bySite[0];
  const periodDays = daysBetween(filters.from, filters.to);
  const canExport = persona.capabilities.canExport;

  const barData = dimension === "site" ? bySite : byProject.map((p) => ({ label: p.projectCode, sales: p.sales, key: p.projectCode }));

  return (
    <div>
      <PageHeader
        title="Grafik Perbandingan Sales"
        description="Bandingkan penjualan antar site, project, dan waktu dalam satu tampilan."
        breadcrumbs={[{ label: "Overview" }, { label: "Perbandingan Sales" }]}
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
          <KpiCard label="Total Sales" value={totalSales} format="currency" icon={ShoppingCart} tone="primary" />
          <KpiCard label="Rata-rata / Site" value={avgPerSite} format="currency" icon={ShoppingCart} tone="info" />
          <KpiCard label="Site Terbaik" value={topSite?.label ?? "-"} format="text" icon={ShoppingCart} tone="success" />
          <KpiCard label="Jumlah Site" value={filteredSites.length} format="number" icon={ShoppingCart} tone="muted" />
        </section>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle>Perbandingan Sales per {dimension === "site" ? "Site" : "Project"}</CardTitle>
              <CardDescription>Diurutkan dari sales tertinggi.</CardDescription>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              {(["site", "project"] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDimension(d)}
                  className={cn(
                    "rounded-md border px-2 py-1 text-xs font-medium",
                    dimension === d
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-background hover:bg-accent",
                  )}
                >
                  {d === "site" ? "Per Site" : "Per Project"}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            <SalesCompareBar data={barData} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tren Sales</CardTitle>
            <CardDescription>Perkembangan sales sepanjang periode aktif.</CardDescription>
          </CardHeader>
          <CardContent>
            {trend.length === 0 ? (
              <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
                Tidak ada data.
              </div>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trend} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 32% 91%)" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="hsl(215 16% 47%)" tickLine={false} axisLine={false} />
                    <YAxis
                      tick={{ fontSize: 10 }}
                      stroke="hsl(215 16% 47%)"
                      tickLine={false}
                      axisLine={false}
                      width={56}
                      tickFormatter={(v) => `${(v / 1_000_000_000).toFixed(1)}M`}
                    />
                    <Tooltip
                      contentStyle={{ borderRadius: 8, border: "1px solid hsl(214 32% 91%)", fontSize: 12 }}
                      formatter={(v: number) => [formatCurrency(v), "Sales"]}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
                    <Line type="monotone" dataKey="sales" name="Sales" stroke="hsl(221 83% 45%)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
