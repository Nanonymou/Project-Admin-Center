"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Download, Info, Lock, RefreshCcw } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { ActivityFilterBar } from "@/components/activity/activity-filter-bar";
import { ActivePeriodBadge } from "@/components/common/active-period-badge";
import { MarginSummaryCards, summarizeMargin } from "@/components/margin/margin-summary-cards";
import { ProfitTrendChart } from "@/components/margin/profit-trend-chart";
import { ProfitLineChart } from "@/components/margin/profit-line-chart";
import { ProfitBySiteChart } from "@/components/margin/profit-by-site-chart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { usePersona } from "@/components/providers/persona-provider";
import { useGlobalFilters } from "@/components/providers/global-filter-provider";
import {
  daysBetween,
  scaleSiteKpisByPeriod,
  SITE_KPI,
} from "@/lib/mock/site-kpi";
import { buildMarginBySite, buildProfitTrendForRange, buildSalesByProject } from "@/lib/mock/margin-data";
import { LOCATION_OPTIONS, PROJECT_OPTIONS } from "@/lib/mock/filters";
import { canAccessLocation } from "@/lib/personas";
import { cn, formatCurrency } from "@/lib/utils";

export function MarginDashboardClient() {
  const { persona } = usePersona();
  const { filters, setFilters, reset } = useGlobalFilters();
  const [trendView, setTrendView] = useState<"composite" | "line">("composite");

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

  const trend = useMemo(
    () => buildProfitTrendForRange(filteredSites, filters.from, filters.to),
    [filteredSites, filters.from, filters.to],
  );
  const bySite = useMemo(() => buildMarginBySite(filteredSites), [filteredSites]);
  const byProject = useMemo(() => buildSalesByProject(filteredSites), [filteredSites]);
  const periodDays = daysBetween(filters.from, filters.to);
  const grandSales = byProject.reduce((s, p) => s + p.sales, 0) || 1;
  const trendGranularity = periodDays <= 62 ? "harian" : "bulanan";

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

        <MarginSummaryCards summary={summarizeMargin(filteredSites)} />

        <Card>
          <CardHeader className="flex flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle>Tren Profit & Margin ({trendGranularity})</CardTitle>
              <CardDescription>
                Periode {filters.from} → {filters.to} · titik {trendGranularity}.
                {trendView === "composite"
                  ? " Area = profit, garis = sales/cost, ungu = margin % (aksis kanan)."
                  : " Garis Sales / Cost / Profit — klik legenda untuk sembunyikan."}
              </CardDescription>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              {(["composite", "line"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setTrendView(v)}
                  className={cn(
                    "rounded-md border px-2 py-1 text-xs font-medium",
                    trendView === v
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-background hover:bg-accent",
                  )}
                >
                  {v === "composite" ? "Komposit" : "Garis"}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            {filteredSites.length > 0 ? (
              trendView === "composite" ? (
                <ProfitTrendChart data={trend} />
              ) : (
                <ProfitLineChart data={trend} />
              )
            ) : (
              <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">
                Tidak ada site dalam scope.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Total Sales per Project</CardTitle>
            <CardDescription>
              Kontribusi sales tiap project pada periode aktif — termasuk PHSS, BUMA, POMALA, PHKT
              (sesuai scope).
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {byProject.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">Tidak ada data.</div>
            ) : (
              <ul className="divide-y">
                {byProject.map((p) => {
                  const pct = (p.sales / grandSales) * 100;
                  return (
                    <li key={p.projectCode} className="flex items-center gap-3 px-4 py-3">
                      <Link
                        href={`/margin/${p.projectCode.toLowerCase()}`}
                        className="flex h-8 w-12 shrink-0 items-center justify-center rounded bg-primary/10 text-[11px] font-bold text-primary hover:bg-primary/20"
                      >
                        {p.projectCode}
                      </Link>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-sm font-medium tabular-nums">{formatCurrency(p.sales)}</span>
                          <span className="text-[11px] text-muted-foreground tabular-nums">
                            {p.siteCount} site · margin {p.marginPct.toFixed(1)}%
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded bg-muted">
                          <div className="h-full rounded bg-primary" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                      <span className="w-12 text-right text-xs tabular-nums text-muted-foreground">
                        {pct.toFixed(0)}%
                      </span>
                    </li>
                  );
                })}
              </ul>
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
              <ProfitBySiteChart data={bySite} />
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
