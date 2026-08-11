"use client";

import { useMemo, useState } from "react";
import { Inbox, Bell, CalendarClock, Filter, MapPin } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePersona } from "@/components/providers/persona-provider";
import { canAccessLocation } from "@/lib/personas";
import { cn } from "@/lib/utils";
import { SITE_KPI } from "@/lib/mock/site-kpi";
import { buildReminders } from "@/lib/mock/reminders";
import { buildDeadlines, STATUS_META } from "@/lib/mock/deadlines";

type NotifSource = "reminder" | "deadline";
type NotifLevel = "info" | "warning" | "danger";

type NotifEntry = {
  id: string;
  source: NotifSource;
  level: NotifLevel;
  title: string;
  detail: string;
  location: string;
  dueLabel: string;
  order: number; // lower = more urgent
};

const LEVEL_META: Record<NotifLevel, { label: string; variant: "info" | "warning" | "danger" }> = {
  info: { label: "Info", variant: "info" },
  warning: { label: "Peringatan", variant: "warning" },
  danger: { label: "Kritis", variant: "danger" },
};

/**
 * Pusat Notifikasi & Reminder — a unified inbox that merges cut-off reminders and
 * deadline notifications across the sites a persona can see into one urgency-
 * ranked feed, filterable by source and severity. Frontend-first (reminders +
 * deadlines mocks), persona-scoped, no backend required.
 */
export function PusatNotifikasiClient() {
  const { persona } = usePersona();

  const scopedSites = useMemo(
    () => SITE_KPI.filter((s) => canAccessLocation(persona, s.locationId, s.projectCode)),
    [persona],
  );

  const entries = useMemo<NotifEntry[]>(() => {
    const out: NotifEntry[] = [];

    for (const site of scopedSites) {
      for (const r of buildReminders(site)) {
        out.push({
          id: `rem-${r.id}`,
          source: "reminder",
          level: r.level === "critical" ? "danger" : r.level,
          title: r.title,
          detail: r.detail,
          location: `${site.locationName} · ${site.projectCode}`,
          dueLabel: r.dueLabel,
          order: r.level === "critical" ? 0 : r.level === "warning" ? 1 : 2,
        });
      }
    }

    for (const d of buildDeadlines(scopedSites)) {
      const level: NotifLevel =
        d.status === "overdue" || d.status === "due_today" ? "danger" : d.status === "due_soon" ? "warning" : "info";
      out.push({
        id: `dl-${d.id}`,
        source: "deadline",
        level,
        title: d.title,
        detail: `PIC ${d.owner} · progres ${d.progressPct}%`,
        location: `${d.locationName} · ${d.projectCode}`,
        dueLabel: d.dueLabel,
        order: d.daysRelative,
      });
    }

    return out.sort((a, b) => a.order - b.order);
  }, [scopedSites]);

  const [sourceFilter, setSourceFilter] = useState<"all" | NotifSource>("all");
  const [levelFilter, setLevelFilter] = useState<"all" | NotifLevel>("all");

  const visible = useMemo(
    () =>
      entries.filter(
        (e) => (sourceFilter === "all" || e.source === sourceFilter) && (levelFilter === "all" || e.level === levelFilter),
      ),
    [entries, sourceFilter, levelFilter],
  );

  const counts = useMemo(
    () => ({
      reminders: entries.filter((e) => e.source === "reminder").length,
      deadlines: entries.filter((e) => e.source === "deadline").length,
      critical: entries.filter((e) => e.level === "danger").length,
    }),
    [entries],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pusat Notifikasi & Reminder"
        description="Satu inbox untuk reminder cut-off dan notifikasi tenggat lintas site dalam cakupan Anda."
      />
      <PersonaBanner persona={persona} scopeSummary={`${scopedSites.length} site accessible`} />

      <div className="grid grid-cols-3 gap-3">
        <SummaryTile icon={Bell} label="Reminder" value={counts.reminders} />
        <SummaryTile icon={CalendarClock} label="Tenggat" value={counts.deadlines} />
        <SummaryTile icon={Inbox} label="Kritis" value={counts.critical} tone="danger" />
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Inbox className="h-5 w-5" />
                Inbox Notifikasi
              </CardTitle>
              <CardDescription>{visible.length} notifikasi ditampilkan</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Filter className="h-4 w-4" />
                <select
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value as "all" | NotifSource)}
                  className="rounded-md border bg-background px-2 py-1 text-sm"
                  aria-label="Filter sumber"
                >
                  <option value="all">Semua sumber</option>
                  <option value="reminder">Reminder</option>
                  <option value="deadline">Tenggat</option>
                </select>
              </div>
              <select
                value={levelFilter}
                onChange={(e) => setLevelFilter(e.target.value as "all" | NotifLevel)}
                className="rounded-md border bg-background px-2 py-1 text-sm"
                aria-label="Filter level"
              >
                <option value="all">Semua level</option>
                <option value="danger">Kritis</option>
                <option value="warning">Peringatan</option>
                <option value="info">Info</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {visible.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Tidak ada notifikasi.</p>
          ) : (
            <ol className="space-y-3">
              {visible.map((e) => {
                const meta = LEVEL_META[e.level];
                const SourceIcon = e.source === "reminder" ? Bell : CalendarClock;
                return (
                  <li key={e.id} className="flex items-start gap-3 rounded-lg border p-3">
                    <Badge variant={meta.variant} className="mt-0.5 shrink-0">
                      {meta.label}
                    </Badge>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <SourceIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="font-medium">{e.title}</span>
                        <span className="ml-auto text-xs text-muted-foreground">{e.dueLabel}</span>
                      </div>
                      <p className="mt-0.5 text-sm text-foreground">{e.detail}</p>
                      <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        {e.location}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryTile({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Inbox;
  label: string;
  value: number;
  tone?: "danger";
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <Icon className={cn("h-6 w-6 shrink-0", tone === "danger" ? "text-rose-600" : "text-sky-600")} />
        <div>
          <p className="text-2xl font-semibold">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
