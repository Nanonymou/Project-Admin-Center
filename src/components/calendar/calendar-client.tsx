"use client";

import { useMemo } from "react";
import { CalendarDays, Download, Info, Lock, RefreshCcw } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { DeadlineCalendar } from "@/components/calendar/deadline-calendar";
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

  const scopedSites = useMemo(
    () => SITE_KPI.filter((s) => canAccessLocation(persona, s.locationId, s.projectCode)),
    [persona],
  );

  const deadlines = useMemo(() => buildDeadlines(scopedSites), [scopedSites]);

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

        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiCard label="Total Deadline" value={counts.total} format="number" icon={CalendarDays} tone="primary" />
          <KpiCard label="Overdue" value={counts.overdue} format="number" icon={AlarmClock} tone="danger" />
          <KpiCard label="Due Soon" value={counts.dueSoon} format="number" icon={CalendarClock} tone="warning" />
          <KpiCard label="Settled" value={counts.settled} format="number" icon={CheckCircle2} tone="success" />
        </section>

        <DeadlineCalendar items={deadlines} />
      </div>
    </div>
  );
}
