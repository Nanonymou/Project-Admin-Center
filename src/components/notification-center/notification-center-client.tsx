"use client";

import { useMemo, useState } from "react";
import { Bell, BellOff, Check, Filter, MapPin } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePersona } from "@/components/providers/persona-provider";
import { canAccessLocation } from "@/lib/personas";
import { cn } from "@/lib/utils";
import { SITE_KPI } from "@/lib/mock/site-kpi";
import { buildReminders, reminderTriggerLabel, type ReminderLevel, type ReminderItem } from "@/lib/mock/reminders";

const LEVEL_META: Record<ReminderLevel, { label: string; variant: "info" | "warning" | "danger" }> = {
  info: { label: "Info", variant: "info" },
  warning: { label: "Peringatan", variant: "warning" },
  critical: { label: "Kritis", variant: "danger" },
};

/**
 * Notification Center — the cut-off reminder feed (Reminder Cut-Off Otomatis)
 * aggregated across the sites a persona can see, sorted most-urgent first. Each
 * item can be acknowledged locally; filter by severity level. Frontend-first:
 * driven by the `reminders` mock (PRD §16.E Reminder Matrix), no backend required.
 */
export function NotificationCenterClient() {
  const { persona } = usePersona();

  const accessibleSites = useMemo(
    () => SITE_KPI.filter((s) => canAccessLocation(persona, s.locationId, s.projectCode)),
    [persona],
  );

  const reminders = useMemo(
    () => accessibleSites.flatMap((s) => buildReminders(s)),
    [accessibleSites],
  );

  const [levelFilter, setLevelFilter] = useState<"all" | ReminderLevel>("all");
  const [acked, setAcked] = useState<Record<string, boolean>>({});

  const LEVEL_ORDER: Record<ReminderLevel, number> = { critical: 0, warning: 1, info: 2 };
  const visible = useMemo(() => {
    const filtered = levelFilter === "all" ? reminders : reminders.filter((r) => r.level === levelFilter);
    return [...filtered].sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reminders, levelFilter]);

  const unreadCount = visible.filter((r) => !acked[r.id]).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notification Center"
        description="Pusat notifikasi reminder cut-off & jatuh tempo untuk site dalam cakupan Anda."
      />
      <PersonaBanner persona={persona} scopeSummary={`${accessibleSites.length} site accessible`} />

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notifikasi
                {unreadCount > 0 && (
                  <Badge variant="danger" className="ml-1">
                    {unreadCount} belum dibaca
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                {visible.length} notifikasi · {accessibleSites.length} site
              </CardDescription>
            </div>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Filter className="h-4 w-4" />
              <select
                value={levelFilter}
                onChange={(e) => setLevelFilter(e.target.value as "all" | ReminderLevel)}
                className="rounded-md border bg-background px-2 py-1 text-sm"
                aria-label="Filter level"
              >
                <option value="all">Semua level</option>
                <option value="critical">Kritis</option>
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
              {visible.map((item) => (
                <NotificationRow
                  key={item.id}
                  item={item}
                  acked={Boolean(acked[item.id])}
                  onToggle={() => setAcked((prev) => ({ ...prev, [item.id]: !prev[item.id] }))}
                />
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function NotificationRow({
  item,
  acked,
  onToggle,
}: {
  item: ReminderItem;
  acked: boolean;
  onToggle: () => void;
}) {
  const meta = LEVEL_META[item.level];
  return (
    <li className={cn("flex items-start gap-3 rounded-lg border p-3", acked && "opacity-60")}>
      <Badge variant={meta.variant} className="mt-0.5 shrink-0">
        {meta.label}
      </Badge>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-medium">{item.title}</span>
          <span className="text-xs text-muted-foreground">· {reminderTriggerLabel(item.trigger)}</span>
          <span className="ml-auto text-xs text-muted-foreground">{item.dueLabel}</span>
        </div>
        <p className="mt-0.5 text-sm text-foreground">{item.detail}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {item.target}
          </span>
          <span>Untuk: {item.audience}</span>
          <span>· {item.createdRelative}</span>
        </div>
      </div>
      <button
        type="button"
        onClick={onToggle}
        className="inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-accent"
        aria-label={acked ? "Tandai belum dibaca" : "Tandai sudah dibaca"}
      >
        {acked ? <BellOff className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
        {acked ? "Batalkan" : "Tandai baca"}
      </button>
    </li>
  );
}
