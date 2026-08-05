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
import { buildAggregateTimelines, type AggregateTimelineRow } from "@/lib/mock/aggregate-timeline";
import { GanttChart } from "@/components/timeline/gantt-chart";
import { Dialog } from "@/components/ui/dialog";
import { invoiceHref } from "@/lib/mock/invoice-lookup";
import {
  buildTimelineActivity,
  completedStageCount,
  timelineHealth,
} from "@/lib/mock/timeline-activity";
import { LOCATION_OPTIONS, PROJECT_OPTIONS } from "@/lib/mock/filters";
import { canAccessLocation } from "@/lib/personas";
import { cn, formatCurrency } from "@/lib/utils";

export function AggregateTimelineClient() {
  const { persona } = usePersona();
  const { filters, setFilters, reset } = useGlobalFilters();
  const [sortKey, setSortKey] = useState<"elapsed" | "amount">("elapsed");
  const [statusFilter, setStatusFilter] = useState<"all" | "onTime" | "atRisk" | "overdue">("all");
  const [activeRow, setActiveRow] = useState<AggregateTimelineRow | null>(null);

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

  const allRows = useMemo(
    () => buildAggregateTimelines(filteredSites, SITE_DETAILS),
    [filteredSites],
  );

  const statusCounts = useMemo(
    () => ({
      all: allRows.length,
      onTime: allRows.filter((r) => r.status === "onTime").length,
      atRisk: allRows.filter((r) => r.status === "atRisk").length,
      overdue: allRows.filter((r) => r.status === "overdue").length,
    }),
    [allRows],
  );

  const rows = useMemo(() => {
    let list =
      statusFilter === "all" ? allRows : allRows.filter((r) => r.status === statusFilter);
    if (sortKey === "amount") list = [...list].sort((a, b) => b.amount - a.amount);
    return list;
  }, [allRows, statusFilter, sortKey]);

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
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Status
              </span>
              {(
                [
                  { key: "all", label: "Semua", tone: "" },
                  { key: "onTime", label: "On Time", tone: "border-emerald-500 bg-emerald-500 text-white" },
                  { key: "atRisk", label: "At Risk", tone: "border-amber-500 bg-amber-500 text-white" },
                  { key: "overdue", label: "Overdue", tone: "border-rose-500 bg-rose-500 text-white" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setStatusFilter(opt.key)}
                  className={cn(
                    "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                    statusFilter === opt.key
                      ? opt.tone || "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-background hover:bg-accent",
                  )}
                >
                  {opt.label} · {statusCounts[opt.key]}
                </button>
              ))}
            </div>
            {rows.length === 0 ? (
              <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                Tidak ada invoice cocok dengan filter aktif.
              </div>
            ) : (
              <GanttChart rows={rows} maxSpan={maxSpan} onSelect={setActiveRow} />
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={activeRow !== null}
        onClose={() => setActiveRow(null)}
        title={activeRow?.invoiceNumber}
        description={
          activeRow
            ? `${activeRow.projectCode} · ${activeRow.locationName} · ${formatCurrency(activeRow.amount)}`
            : undefined
        }
        footer={
          activeRow && (
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">
                {activeRow.totalElapsedDays} hari berjalan · PIC {activeRow.pic}
              </span>
              <Link href={invoiceHref(activeRow.invoiceNumber)}>
                <Button size="sm">Buka Detail Invoice</Button>
              </Link>
            </div>
          )
        }
      >
        {activeRow && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge
                variant={
                  activeRow.status === "overdue"
                    ? "danger"
                    : activeRow.status === "atRisk"
                      ? "warning"
                      : "success"
                }
              >
                {activeRow.currentStage}
              </Badge>
              <span className="text-xs text-muted-foreground">
                Status: {activeRow.status === "onTime" ? "On Time" : activeRow.status === "atRisk" ? "At Risk" : "Overdue"}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 p-2 text-[11px]">
              <span className="text-muted-foreground">Kesehatan:</span>
              <Badge
                variant={
                  timelineHealth(activeRow) === "kritis"
                    ? "danger"
                    : timelineHealth(activeRow) === "pantau"
                      ? "warning"
                      : "success"
                }
              >
                {timelineHealth(activeRow)}
              </Badge>
              <span className="text-muted-foreground">
                · {completedStageCount(activeRow)}/{activeRow.stages.length} tahap selesai
              </span>
            </div>

            <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Aktivitas per Tahap
            </div>
            <ol className="relative space-y-0">
              {activeRow.stages.map((s, i) => (
                <li key={s.stage} className="flex gap-3 py-2">
                  <div className="relative mt-0.5 flex flex-col items-center">
                    <span
                      className={cn(
                        "h-2.5 w-2.5 rounded-full ring-4 ring-background",
                        s.state === "done" && "bg-emerald-500",
                        s.state === "current" && "bg-primary",
                        s.state === "overdue" && "bg-rose-500",
                        s.state === "upcoming" && "bg-muted-foreground/40",
                      )}
                    />
                    {i < activeRow.stages.length - 1 && (
                      <span className="mt-1 w-px flex-1 bg-border" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{s.stage}</span>
                      <span className="text-[11px] tabular-nums text-muted-foreground">
                        {s.state === "upcoming" ? `SLA ${s.slaDays}h` : `${s.durationDays}h / SLA ${s.slaDays}h`}
                      </span>
                    </div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                      {s.actor}
                      {s.breachedSla && <span className="ml-1 font-medium text-rose-600">· SLA terlampaui</span>}
                    </div>
                  </div>
                </li>
              ))}
            </ol>

            <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Log Aktivitas
            </div>
            <ul className="space-y-1.5">
              {buildTimelineActivity(activeRow).map((ev) => (
                <li key={ev.id} className="rounded-md border p-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{ev.note}</span>
                    <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                      {ev.dateLabel}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                    {ev.stage} · oleh {ev.actor}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Dialog>
    </div>
  );
}
