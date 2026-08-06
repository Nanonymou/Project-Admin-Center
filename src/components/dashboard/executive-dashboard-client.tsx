"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Info, Lock, RefreshCcw } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { ActivityFilterBar } from "@/components/activity/activity-filter-bar";
import { ActivePeriodBadge } from "@/components/common/active-period-badge";
import { PortfolioSummary } from "@/components/dashboard/portfolio-summary";
import { SiteCard, SiteCardEmpty } from "@/components/dashboard/site-card";
import { SiteComparisonChart } from "@/components/dashboard/site-comparison-chart";
import { AgingDonut } from "@/components/dashboard/aging-donut";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { usePersona } from "@/components/providers/persona-provider";
import { useGlobalFilters } from "@/components/providers/global-filter-provider";
import { useActiveSite } from "@/components/providers/active-site-provider";
import { SiteKpiGrid } from "@/components/site/site-kpi-grid";
import { computeSiteKpi } from "@/lib/mock/site-kpi-calc";
import { getSiteDetail } from "@/lib/mock/site-detail";
import { TopSitesModule } from "@/components/performance/top-sites-module";
import {
  aggregateAging,
  aggregateTotals,
  daysBetween,
  scaleSiteKpisByPeriod,
  SITE_KPI,
} from "@/lib/mock/site-kpi";
import { canAccessLocation } from "@/lib/personas";
import { cn } from "@/lib/utils";
import { LOCATION_OPTIONS, PROJECT_OPTIONS } from "@/lib/mock/filters";

type SortKey = "sales" | "marginPct" | "slaPct" | "overdueInvoices";

const SORT_LABEL: Record<SortKey, string> = {
  sales: "Sales tertinggi",
  marginPct: "Margin tertinggi",
  slaPct: "SLA tertinggi",
  overdueInvoices: "Overdue terbanyak",
};

export function ExecutiveDashboardClient() {
  const { persona } = usePersona();
  const { filters, setFilters, reset } = useGlobalFilters();
  const { activeLocationId, activeWorkspace } = useActiveSite();
  const [sortKey, setSortKey] = useState<SortKey>("sales");

  const accessibleSites = useMemo(
    () => SITE_KPI.filter((s) => canAccessLocation(persona, s.locationId, s.projectCode)),
    [persona],
  );

  const personaProjectOptions = useMemo(
    () => PROJECT_OPTIONS.filter((p) => accessibleSites.some((s) => s.projectCode === p.code)),
    [accessibleSites],
  );
  const personaLocationOptions = useMemo(
    () => LOCATION_OPTIONS.filter((l) => accessibleSites.some((s) => s.locationId === l.id)),
    [accessibleSites],
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

  const scopedSites = useMemo(() => {
    const rows = accessibleSites.filter((s) => {
      if (filters.projects.length > 0 && !filters.projects.includes(s.projectCode)) return false;
      if (filters.locations.length > 0 && !selectedLocationIds.has(s.locationId)) return false;
      return true;
    });
    return scaleSiteKpisByPeriod(rows, filters.from, filters.to);
  }, [accessibleSites, filters.projects, filters.locations, filters.from, filters.to, selectedLocationIds]);

  const periodDays = daysBetween(filters.from, filters.to);

  const sortedSites = useMemo(() => {
    const rows = [...scopedSites];
    rows.sort((a, b) => (b[sortKey] as number) - (a[sortKey] as number));
    return rows;
  }, [scopedSites, sortKey]);

  const totals = useMemo(() => aggregateTotals(scopedSites), [scopedSites]);
  const aging = useMemo(() => aggregateAging(scopedSites), [scopedSites]);

  // Active-site KPI preview — driven by the workspace switcher selection,
  // falling back to the first accessible site when the active one is out of
  // the persona's scope.
  const activeDetail = useMemo(() => {
    const preferred = getSiteDetail(activeLocationId);
    if (preferred && canAccessLocation(persona, preferred.site.locationId, preferred.site.projectCode)) {
      return preferred;
    }
    const first = accessibleSites[0];
    return first ? getSiteDetail(first.locationId) : undefined;
  }, [activeLocationId, persona, accessibleSites]);

  const activeComputed = useMemo(
    () =>
      activeDetail
        ? computeSiteKpi(activeDetail, { from: filters.from, to: filters.to })
        : undefined,
    [activeDetail, filters.from, filters.to],
  );

  const scopeSummary = useMemo(() => {
    if (persona.scope.projects.length === 0 && persona.scope.locations.length === 0)
      return "Semua project & location";
    const projList =
      persona.scope.projects.length === 0
        ? PROJECT_OPTIONS.map((p) => p.code).join(", ")
        : persona.scope.projects.join(", ");
    if (persona.scope.locations.length === 0) return `${projList} · semua location`;
    const locNames = SITE_KPI.filter((s) => persona.scope.locations.includes(s.locationId))
      .map((s) => s.locationName)
      .join(", ");
    return `${projList} · ${locNames}`;
  }, [persona]);

  const canExport = persona.capabilities.canExport;

  return (
    <div>
      <PageHeader
        title="Executive Dashboard"
        description="Agregasi KPI seluruh site: performa finansial, SLA, dan status closing dalam satu pandangan."
        breadcrumbs={[{ label: "Overview" }, { label: "Executive Dashboard" }]}
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
        <PersonaBanner persona={persona} scopeSummary={scopeSummary} />

        <div className="flex items-start gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Filter global aktif — pilihan project, location, dan periode sinkron dengan seluruh
            halaman. Nilai finansial diskalakan terhadap periode{" "}
            <b>{filters.from} → {filters.to}</b> ({periodDays} hari).
          </span>
        </div>

        <ActivityFilterBar
          value={filters}
          onChange={setFilters}
          onReset={reset}
          matchedCount={scopedSites.length}
          projectOptions={personaProjectOptions}
          locationOptions={personaLocationOptions}
        />

        <PortfolioSummary totals={totals} />

        {activeDetail && activeComputed && (
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold">
                  KPI Site Aktif — {activeDetail.site.projectCode} · {activeDetail.site.locationName}
                </h2>
                <p className="text-sm text-muted-foreground">
                  Ganti site aktif lewat Workspace switcher di kanan atas ·
                  {activeDetail.site.locationId === activeWorkspace.locationId
                    ? " sinkron dengan workspace terpilih."
                    : " workspace di luar scope, menampilkan site pertama yang bisa diakses."}
                </p>
              </div>
            </div>
            <SiteKpiGrid site={activeDetail.site} computed={activeComputed} />
          </section>
        )}

        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">KPI per Site</h2>
              <p className="text-sm text-muted-foreground">
                {scopedSites.length === 0
                  ? "Tidak ada site dalam scope Anda."
                  : `${scopedSites.length} site aktif · klik "Open Workspace" untuk masuk ke lokasi.`}
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-muted-foreground">Urut:</span>
              {(Object.keys(SORT_LABEL) as SortKey[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSortKey(key)}
                  className={cn(
                    "rounded-md border px-2 py-1 text-xs font-medium",
                    sortKey === key
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-background hover:bg-accent",
                  )}
                >
                  {SORT_LABEL[key]}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {sortedSites.length === 0 && <SiteCardEmpty />}
            {sortedSites.map((site) => (
              <SiteCard key={site.locationId} site={site} />
            ))}
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Perbandingan Sales / Cost / Margin per Site</CardTitle>
              <CardDescription>
                Diskalakan ke periode {filters.from} → {filters.to} — nilai dalam miliar rupiah.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {scopedSites.length > 0 ? (
                <SiteComparisonChart sites={sortedSites} />
              ) : (
                <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
                  Tidak ada site dalam scope.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Invoice Aging Portfolio</CardTitle>
              <CardDescription>Distribusi outstanding invoice per bucket umur.</CardDescription>
            </CardHeader>
            <CardContent>
              {aging.some((a) => a.amount > 0) ? (
                <AgingDonut data={aging} />
              ) : (
                <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
                  Tidak ada outstanding invoice untuk ditampilkan.
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <section>
          <TopSitesModule sites={scopedSites} />
        </section>
      </div>
    </div>
  );
}
