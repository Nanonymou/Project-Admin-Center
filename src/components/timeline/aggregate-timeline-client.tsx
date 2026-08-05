"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Download, GanttChartSquare, Info, Lock, RefreshCcw } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { ActivityFilterBar } from "@/components/activity/activity-filter-bar";
import { ActivePeriodBadge } from "@/components/common/active-period-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePersona } from "@/components/providers/persona-provider";
import { useGlobalFilters } from "@/components/providers/global-filter-provider";
import { SITE_KPI } from "@/lib/mock/site-kpi";
import { SITE_DETAILS } from "@/lib/mock/site-detail";
import { buildAggregateTimelines } from "@/lib/mock/aggregate-timeline";
import { GanttChart } from "@/components/timeline/gantt-chart";
import { LOCATION_OPTIONS, PROJECT_OPTIONS } from "@/lib/mock/filters";
import { canAccessLocation } from "@/lib/personas";
import { cn } from "@/lib/utils";

export function AggregateTimelineClient() {
  const { persona } = usePersona();
  const { filters, setFilters, reset } = useGlobalFilters();
  const [sortKey, setSortKey] = useState<"elapsed" | "amount">("elapsed");

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
    return scopedSites.filter((s) => {
      if (filters.projects.length > 0 && !filters.projects.includes(s.projectCode)) return false;
      if (filters.locations.length > 0 && !selectedLocationIds.has(s.locationId)) return false;
      return true;
    });
  }, [scopedSites, filters.projects, filters.locations, selectedLocationIds]);

  const rows = useMemo(() => {
    const list = buildAggregateTimelines(filteredSites, SITE_DETAILS);
    if (sortKey === "amount") return [...list].sort((a, b) => b.amount - a.amount);
    return list;
  }, [filteredSites, sortKey]);

  const maxSpan = useMemo(
    () =>
      Math.max(
        1,
        ...rows.map((r) => r.stages.reduce((m, s) => Math.max(m, s.startOffset + s.durationDays), 0)),
      ),
    [rows],
  );

  const canExport = persona.capabilities.canExport;

  return (
    <div>
      <PageHeader
        title="Timeline Approval Seluruh Site"
        description="Gantt agregat alur approval invoice lintas site dalam satu pandangan."
        breadcrumbs={[{ label: "Operasional" }, { label: "Timeline Approval" }]}
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
            Setiap baris = satu invoice; segmen = tahap approval (hijau selesai, biru berjalan,
            merah overdue). Filter global aktif.
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
          <CardHeader className="flex flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2">
                <GanttChartSquare className="h-4 w-4 text-primary" />
                Gantt Approval ({rows.length} invoice)
              </CardTitle>
              <CardDescription>Diurutkan berdasarkan {sortKey === "elapsed" ? "lama berjalan" : "nilai invoice"}.</CardDescription>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-muted-foreground">Urut:</span>
              {(["elapsed", "amount"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setSortKey(k)}
                  className={cn(
                    "rounded-md border px-2 py-1 text-xs font-medium",
                    sortKey === k
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-background hover:bg-accent",
                  )}
                >
                  {k === "elapsed" ? "Durasi" : "Nilai"}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            {rows.length === 0 ? (
              <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                Tidak ada invoice dalam alur approval untuk scope ini.
              </div>
            ) : (
              <GanttChart rows={rows} maxSpan={maxSpan} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
