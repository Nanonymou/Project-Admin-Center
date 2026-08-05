"use client";

import { useMemo, useState } from "react";
import { CalendarDays, Download, Info, Lock, MapPin, RefreshCcw, RotateCcw } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { DeadlineCalendar } from "@/components/calendar/deadline-calendar";
import { DeadlineNotificationList } from "@/components/calendar/deadline-notification-list";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/common/kpi-card";
import { usePersona } from "@/components/providers/persona-provider";
import { SITE_KPI } from "@/lib/mock/site-kpi";
import { buildDeadlines } from "@/lib/mock/deadlines";
import { canAccessLocation } from "@/lib/personas";
import { cn } from "@/lib/utils";
import { AlarmClock, CalendarClock, CheckCircle2 } from "lucide-react";

export function CalendarClient() {
  const { persona } = usePersona();
  const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>([]);

  const scopedSites = useMemo(
    () => SITE_KPI.filter((s) => canAccessLocation(persona, s.locationId, s.projectCode)),
    [persona],
  );

  const filteredSites = useMemo(
    () =>
      selectedLocationIds.length === 0
        ? scopedSites
        : scopedSites.filter((s) => selectedLocationIds.includes(s.locationId)),
    [scopedSites, selectedLocationIds],
  );

  const deadlines = useMemo(() => buildDeadlines(filteredSites), [filteredSites]);

  function toggleSite(id: string) {
    setSelectedLocationIds((prev) =>
      prev.includes(id) ? prev.filter((l) => l !== id) : [...prev, id],
    );
  }

  const sitesByProject = useMemo(() => {
    return scopedSites.reduce<Record<string, typeof scopedSites>>((acc, s) => {
      (acc[s.projectCode] ??= []).push(s);
      return acc;
    }, {});
  }, [scopedSites]);

  const counts = useMemo(() => {
    return deadlines.reduce(
      (acc, d) => {
        acc.total += 1;
        if (d.status === "overdue") acc.overdue += 1;
        if (d.status === "due_today" || d.status === "due_soon") acc.dueSoon += 1;
        if (d.status === "settled") acc.settled += 1;
        return acc;
      },
      { total: 0, overdue: 0, dueSoon: 0, settled: 0 },
    );
  }, [deadlines]);

  const canExport = persona.capabilities.canExport;

  return (
    <div>
      <PageHeader
        title="Kalender Deadline"
        description="Tampilan kalender seluruh tenggat lintas site — closing, submit invoice, approval, dan payment."
        breadcrumbs={[{ label: "Operasional" }, { label: "Kalender Deadline" }]}
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
        <PersonaBanner persona={persona} scopeSummary={`${scopedSites.length} site accessible`} />

        <div className="flex items-start gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Klik tanggal untuk melihat detail deadline. Titik warna menandakan status tiap tenggat.
          </span>
        </div>

        {scopedSites.length > 1 && (
          <div className="rounded-lg border bg-card p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" />
                Filter Site
              </span>
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <span>
                  {selectedLocationIds.length === 0
                    ? "Semua site"
                    : `${selectedLocationIds.length} site`}
                </span>
                {selectedLocationIds.length > 0 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6"
                    onClick={() => setSelectedLocationIds([])}
                  >
                    <RotateCcw className="h-3 w-3" />
                    Reset
                  </Button>
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              {Object.entries(sitesByProject).map(([project, sites]) => (
                <div key={project} className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-muted-foreground">{project}</span>
                  {sites.map((s) => {
                    const active = selectedLocationIds.includes(s.locationId);
                    return (
                      <button
                        key={s.locationId}
                        type="button"
                        onClick={() => toggleSite(s.locationId)}
                        className={cn(
                          "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                          active
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-input bg-background hover:bg-accent",
                        )}
                      >
                        {s.locationName}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}

        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiCard label="Total Deadline" value={counts.total} format="number" icon={CalendarDays} tone="primary" />
          <KpiCard label="Overdue" value={counts.overdue} format="number" icon={AlarmClock} tone="danger" />
          <KpiCard label="Due Soon" value={counts.dueSoon} format="number" icon={CalendarClock} tone="warning" />
          <KpiCard label="Settled" value={counts.settled} format="number" icon={CheckCircle2} tone="success" />
        </section>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,3fr),minmax(0,1fr)]">
          <DeadlineCalendar items={deadlines} />
          <DeadlineNotificationList items={deadlines} />
        </div>
      </div>
    </div>
  );
}
