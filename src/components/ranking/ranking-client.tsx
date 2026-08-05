"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Filter, Info, Lock, RefreshCcw } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { ActivityFilterBar } from "@/components/activity/activity-filter-bar";
import { RankingPodium } from "@/components/ranking/ranking-podium";
import { RankingList } from "@/components/ranking/ranking-list";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { usePersona } from "@/components/providers/persona-provider";
import { useGlobalFilters } from "@/components/providers/global-filter-provider";
import { ActivePeriodBadge } from "@/components/common/active-period-badge";
import { daysBetween, scaleSiteKpisByPeriod, SITE_KPI, type SiteKpi } from "@/lib/mock/site-kpi";
import { LOCATION_OPTIONS, PROJECT_OPTIONS } from "@/lib/mock/filters";
import { canAccessLocation } from "@/lib/personas";
import { cn, formatCurrency } from "@/lib/utils";

type Metric = "sales" | "marginPct" | "slaPct" | "netMargin";

const METRIC_MAP: Record<
  Metric,
  {
    label: string;
    short: string;
    raw: (s: SiteKpi) => number;
    display: (s: SiteKpi) => string;
    prev: ((s: SiteKpi) => number | null) | null;
  }
> = {
  sales: {
    label: "Sales periode berjalan",
    short: "Sales",
    raw: (s) => s.sales,
    display: (s) => formatCurrency(s.sales),
    prev: (s) => (s.prevPeriod ? ((s.sales - s.prevPeriod.sales) / s.prevPeriod.sales) * 100 : null),
  },
  netMargin: {
    label: "Net Margin",
    short: "Net Margin",
    raw: (s) => s.netMargin,
    display: (s) => formatCurrency(s.netMargin),
    prev: null,
  },
  marginPct: {
    label: "Margin %",
    short: "Margin %",
    raw: (s) => s.marginPct,
    display: (s) => `${s.marginPct.toFixed(1)}%`,
    prev: (s) => (s.prevPeriod ? s.marginPct - s.prevPeriod.marginPct : null),
  },
  slaPct: {
    label: "SLA Compliance",
    short: "SLA",
    raw: (s) => s.slaPct,
    display: (s) => `${s.slaPct}%`,
    prev: (s) => (s.prevPeriod ? s.slaPct - s.prevPeriod.slaPct : null),
  },
};

export function RankingClient() {
  const { persona } = usePersona();
  const { filters, setFilters, reset } = useGlobalFilters();
  const [metric, setMetric] = useState<Metric>("sales");

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

  // Drop any global filter entries outside persona scope so users don't see
  // "0 sites" after switching personas.
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

  const periodDays = daysBetween(filters.from, filters.to);

  const cfg = METRIC_MAP[metric];

  const rankedSites = useMemo(() => {
    return [...filteredSites].sort((a, b) => cfg.raw(b) - cfg.raw(a));
  }, [filteredSites, cfg]);

  const scopeSummary = `${scopedSites.length} site accessible`;
  const canExport = persona.capabilities.canExport;

  return (
    <div>
      <PageHeader
        title="Ranking Site"
        description="Perbandingan performa site berdasarkan Sales, Margin, atau SLA — filter global tersinkronisasi dengan halaman lain."
        breadcrumbs={[{ label: "Overview" }, { label: "Ranking Site" }]}
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
            Filter di bawah bersifat <b>global</b> — pilihan tanggal, project, dan location
            sinkron dengan Activity Dashboard dan tersimpan di sesi Anda.
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

        <Card>
          <CardContent className="flex flex-wrap items-center gap-3 p-4">
            <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Filter className="h-3.5 w-3.5" />
              Metrik Ranking
            </span>
            {(Object.keys(METRIC_MAP) as Metric[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setMetric(k)}
                className={cn(
                  "rounded-md border px-2.5 py-1 text-xs font-medium",
                  metric === k
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-background hover:bg-accent",
                )}
              >
                {METRIC_MAP[k].short}
              </button>
            ))}
            <div className="ml-auto text-xs text-muted-foreground">
              Ranking <b className="text-foreground">{rankedSites.length}</b> site ·
              periode <b className="text-foreground">{filters.from} → {filters.to}</b>
              {" · "}
              <span title="Skala nilai relatif terhadap baseline 30 hari">
                {periodDays} hari
              </span>
            </div>
          </CardContent>
        </Card>

        {rankedSites.length > 0 && (
          <section>
            <div className="mb-3">
              <h2 className="text-base font-semibold">Podium — {cfg.label}</h2>
              <p className="text-sm text-muted-foreground">
                Top 3 site berdasarkan {cfg.short}. Delta % relatif periode sebelumnya.
              </p>
            </div>
            <RankingPodium
              sites={rankedSites.slice(0, 3)}
              metricLabel={cfg.short}
              metricValue={cfg.display}
            />
          </section>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Ranking Lengkap</CardTitle>
            <CardDescription>
              Diurutkan berdasarkan <b>{cfg.label}</b> dengan filter global aktif.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <RankingList
              sites={rankedSites}
              metricLabel={cfg.short}
              metricValue={cfg.display}
              metricRaw={cfg.raw}
              deltaValue={cfg.prev ?? undefined}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
