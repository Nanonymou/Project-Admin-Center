"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Lock, RefreshCcw } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/activity/kpi-card";
import { HourlyTrendChart } from "@/components/activity/hourly-trend-chart";
import { SlaStageChart } from "@/components/activity/sla-stage-chart";
import { ActivityFeed } from "@/components/activity/activity-feed";
import { SiteActivityTable } from "@/components/activity/site-activity-table";
import { ActivityFilterBar } from "@/components/activity/activity-filter-bar";
import { ComparisonPanel } from "@/components/activity/comparison-panel";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { usePersona } from "@/components/providers/persona-provider";
import {
  ACTIVITY_FEED,
  ACTIVITY_KPIS,
  COMPARISON_STATS,
  HOURLY_TREND,
  SITE_ACTIVITY,
  SLA_STAGE_BARS,
} from "@/lib/mock/activity";
import {
  DEFAULT_FILTER_STATE,
  LOCATION_OPTIONS,
  PROJECT_OPTIONS,
  type ActivityFilterState,
} from "@/lib/mock/filters";
import { canAccessLocation, canAccessProject } from "@/lib/personas";
import { cn } from "@/lib/utils";

export function ActivityDashboardClient() {
  const { persona } = usePersona();
  const [filters, setFilters] = useState<ActivityFilterState>(DEFAULT_FILTER_STATE);
  const [showComparison, setShowComparison] = useState(true);

  // Persona-scoped option lists (drives what shows in the filter bar).
  const personaProjectOptions = useMemo(
    () => PROJECT_OPTIONS.filter((p) => canAccessProject(persona, p.code)),
    [persona],
  );
  const personaLocationOptions = useMemo(
    () => LOCATION_OPTIONS.filter((l) => canAccessLocation(persona, l.id, l.projectCode)),
    [persona],
  );

  // Reset user-selected filters whose values are no longer in persona scope.
  useEffect(() => {
    const validProjectCodes = new Set(personaProjectOptions.map((p) => p.code));
    const validLocationIds = new Set(personaLocationOptions.map((l) => l.id));
    setFilters((prev) => {
      const nextProjects = prev.projects.filter((p) => validProjectCodes.has(p));
      const nextLocations = prev.locations.filter((l) => validLocationIds.has(l));
      if (nextProjects.length === prev.projects.length && nextLocations.length === prev.locations.length) {
        return prev;
      }
      return { ...prev, projects: nextProjects, locations: nextLocations };
    });
  }, [personaProjectOptions, personaLocationOptions]);

  const selectedLocationNames = useMemo(
    () =>
      new Set(
        LOCATION_OPTIONS.filter((l) => filters.locations.includes(l.id)).map((l) => l.name),
      ),
    [filters.locations],
  );

  // Persona-visible location names — used for scoping when the user hasn't
  // narrowed the filter further.
  const personaLocationNames = useMemo(
    () => new Set(personaLocationOptions.map((l) => l.name)),
    [personaLocationOptions],
  );
  const personaProjectCodes = useMemo(
    () => new Set(personaProjectOptions.map((p) => p.code)),
    [personaProjectOptions],
  );

  function rowInPersonaScope(project: string, location: string) {
    if (!personaProjectCodes.has(project)) return false;
    // If persona has explicit locations, enforce them; otherwise allow.
    if (persona.scope.locations.length === 0) return true;
    return personaLocationNames.has(location);
  }

  const scopedSites = useMemo(
    () => SITE_ACTIVITY.filter((row) => rowInPersonaScope(row.project, row.location)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [persona],
  );

  const filteredSites = useMemo(() => {
    return scopedSites.filter((row) => {
      if (filters.projects.length > 0 && !filters.projects.includes(row.project)) return false;
      if (filters.locations.length > 0 && !selectedLocationNames.has(row.location)) return false;
      return true;
    });
  }, [scopedSites, filters.projects, filters.locations, selectedLocationNames]);

  const scopedFeed = useMemo(
    () => ACTIVITY_FEED.filter((item) => rowInPersonaScope(item.project, item.location)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [persona],
  );

  const filteredFeed = useMemo(() => {
    return scopedFeed.filter((item) => {
      if (filters.projects.length > 0 && !filters.projects.includes(item.project)) return false;
      if (filters.locations.length > 0 && !selectedLocationNames.has(item.location)) return false;
      return true;
    });
  }, [scopedFeed, filters.projects, filters.locations, selectedLocationNames]);

  const scopeSummary = useMemo(() => {
    if (personaProjectOptions.length === PROJECT_OPTIONS.length && persona.scope.locations.length === 0) {
      return "Semua project & location";
    }
    const proj = personaProjectOptions.map((p) => p.code).join(", ") || "—";
    if (persona.scope.locations.length > 0) {
      const locs = personaLocationOptions.map((l) => l.name).join(", ");
      return `${proj} · ${locs}`;
    }
    return `${proj} · semua location`;
  }, [persona, personaProjectOptions, personaLocationOptions]);

  const scopeLabel = useMemo(() => {
    const p = filters.projects.length === 0 ? "Semua project" : filters.projects.join(", ");
    const l = filters.locations.length === 0 ? "semua location" : `${filters.locations.length} location`;
    return `${p} · ${l}`;
  }, [filters.projects, filters.locations]);

  const canExport = persona.capabilities.canExport;

  return (
    <div>
      <PageHeader
        title="Activity Dashboard"
        description="Ringkasan aktivitas operasional multi-site secara real-time — transaksi, SLA, dan status approval."
        breadcrumbs={[
          { label: "Overview" },
          { label: "Activity Dashboard" },
        ]}
        actions={
          <>
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

        <ActivityFilterBar
          value={filters}
          onChange={setFilters}
          onReset={() => setFilters({ ...DEFAULT_FILTER_STATE })}
          matchedCount={filteredSites.length}
          projectOptions={personaProjectOptions}
          locationOptions={personaLocationOptions}
        />

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {ACTIVITY_KPIS.map((kpi) => (
            <KpiCard key={kpi.key} kpi={kpi} />
          ))}
        </section>

        <section>
          <ComparisonPanel stats={COMPARISON_STATS} />
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle>Transaksi per Jam</CardTitle>
                <CardDescription>
                  Sales vs Cost — {scopeLabel} · {filters.from} → {filters.to}
                </CardDescription>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-primary" /> Sales
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-amber-500" /> Cost
                </span>
                <label className="ml-1 inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 hover:bg-accent">
                  <input
                    type="checkbox"
                    checked={showComparison}
                    onChange={(e) => setShowComparison(e.target.checked)}
                    className="h-3 w-3 accent-primary"
                  />
                  <span>Bandingkan kemarin</span>
                </label>
              </div>
            </CardHeader>
            <CardContent>
              <HourlyTrendChart data={HOURLY_TREND} showComparison={showComparison} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>SLA per Tahap</CardTitle>
              <CardDescription>Status invoice per stage approval.</CardDescription>
            </CardHeader>
            <CardContent>
              <SlaStageChart data={SLA_STAGE_BARS} />
            </CardContent>
          </Card>
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>Aktivitas per Site</CardTitle>
                <CardDescription>
                  {filteredSites.length === scopedSites.length
                    ? `Menampilkan ${scopedSites.length} site dalam scope Anda.`
                    : `Menampilkan ${filteredSites.length} dari ${scopedSites.length} site scope.`}
                </CardDescription>
              </div>
              <Button variant="ghost" size="sm">Lihat semua</Button>
            </CardHeader>
            <CardContent className="p-0">
              {filteredSites.length > 0 ? (
                <SiteActivityTable rows={filteredSites} />
              ) : (
                <EmptyState label="Tidak ada site cocok dengan filter aktif." />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>Live Activity</CardTitle>
                <CardDescription>
                  {filteredFeed.length === scopedFeed.length
                    ? `${scopedFeed.length} kejadian dalam scope.`
                    : `${filteredFeed.length} dari ${scopedFeed.length} kejadian scope.`}
                </CardDescription>
              </div>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-600">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                Live
              </span>
            </CardHeader>
            <CardContent className="pt-0">
              {filteredFeed.length > 0 ? (
                <ActivityFeed items={filteredFeed} />
              ) : (
                <EmptyState label="Belum ada aktivitas untuk filter ini." />
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex h-40 items-center justify-center px-6 text-center text-sm text-muted-foreground">
      {label}
    </div>
  );
}
