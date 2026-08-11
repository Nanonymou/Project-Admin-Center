"use client";

import { useMemo } from "react";
import { CalendarDays, AlarmClock, CalendarClock, AlertTriangle, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { DeadlineCalendar } from "@/components/calendar/deadline-calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePersona } from "@/components/providers/persona-provider";
import { canAccessLocation } from "@/lib/personas";
import { SITE_KPI } from "@/lib/mock/site-kpi";
import { buildDeadlines, STATUS_META } from "@/lib/mock/deadlines";

/**
 * Dashboard Calendar — a month calendar of the key deadlines (closing, invoice
 * submit, approval, payment, audit) across the sites a persona can see, with
 * summary tiles and an upcoming‑events list. Reuses the shared DeadlineCalendar
 * grid. Persona‑scoped, frontend‑first (mock `deadlines`), no backend required.
 */
export function DashboardCalendarClient() {
  const { persona } = usePersona();

  const scopedSites = useMemo(
    () => SITE_KPI.filter((s) => canAccessLocation(persona, s.locationId, s.projectCode)),
    [persona],
  );

  const deadlines = useMemo(() => buildDeadlines(scopedSites), [scopedSites]);

  const summary = useMemo(() => {
    const overdue = deadlines.filter((d) => d.status === "overdue").length;
    const dueToday = deadlines.filter((d) => d.status === "due_today").length;
    const dueSoon = deadlines.filter((d) => d.status === "due_soon").length;
    const settled = deadlines.filter((d) => d.status === "settled").length;
    return { overdue, dueToday, dueSoon, settled };
  }, [deadlines]);

  const upcoming = useMemo(
    () =>
      [...deadlines]
        .filter((d) => d.status !== "settled")
        .sort((a, b) => a.daysRelative - b.daysRelative)
        .slice(0, 8),
    [deadlines],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard Calendar"
        description="Kalender tenggat closing, invoice, approval, dan pembayaran untuk site dalam cakupan Anda."
      />
      <PersonaBanner persona={persona} scopeSummary={`${scopedSites.length} site accessible`} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <SummaryTile icon={AlertTriangle} label="Terlambat" value={summary.overdue} tone="danger" />
        <SummaryTile icon={AlarmClock} label="Jatuh tempo hari ini" value={summary.dueToday} tone="danger" />
        <SummaryTile icon={CalendarClock} label="≤ 3 hari" value={summary.dueSoon} tone="warning" />
        <SummaryTile icon={CheckCircle2} label="Selesai" value={summary.settled} tone="success" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              Kalender Tenggat
            </CardTitle>
            <CardDescription>{deadlines.length} tenggat pada cakupan Anda</CardDescription>
          </CardHeader>
          <CardContent>
            <DeadlineCalendar items={deadlines} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tenggat Terdekat</CardTitle>
            <CardDescription>{upcoming.length} agenda berikutnya</CardDescription>
          </CardHeader>
          <CardContent>
            {upcoming.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Tidak ada tenggat aktif.</p>
            ) : (
              <ol className="space-y-3">
                {upcoming.map((d) => {
                  const meta = STATUS_META[d.status];
                  return (
                    <li key={d.id} className="rounded-lg border p-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{d.title}</span>
                        <Badge variant={meta.variant} className="ml-auto">
                          {meta.label}
                        </Badge>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                        <span>{d.locationName} · {d.projectCode}</span>
                        <span>{d.dueLabel}</span>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SummaryTile({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof CalendarDays;
  label: string;
  value: number;
  tone: "danger" | "warning" | "success";
}) {
  const toneClass =
    tone === "danger"
      ? "text-rose-600"
      : tone === "warning"
        ? "text-amber-600"
        : "text-emerald-600";
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <Icon className={`h-6 w-6 shrink-0 ${toneClass}`} />
        <div>
          <p className="text-2xl font-semibold">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
