"use client";

import { useMemo, useState } from "react";
import {
  AlertOctagon,
  AlertTriangle,
  Bell,
  BellOff,
  CalendarClock,
  Check,
  Clock3,
  Filter,
  Timer,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  reminderTriggerLabel,
  type ReminderItem,
  type ReminderLevel,
  type ReminderTrigger,
} from "@/lib/mock/reminders";
import { cn } from "@/lib/utils";

const LEVEL_META: Record<
  ReminderLevel,
  {
    label: string;
    variant: "info" | "warning" | "danger";
    ringClass: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  info: {
    label: "Info",
    variant: "info",
    ringClass: "border-sky-200 bg-sky-50",
    icon: Bell,
  },
  warning: {
    label: "Warning",
    variant: "warning",
    ringClass: "border-amber-200 bg-amber-50",
    icon: AlertTriangle,
  },
  critical: {
    label: "Critical",
    variant: "danger",
    ringClass: "border-rose-200 bg-rose-50",
    icon: AlertOctagon,
  },
};

const TRIGGER_ICON: Record<ReminderTrigger, React.ComponentType<{ className?: string }>> = {
  h_minus_7: CalendarClock,
  h_minus_3: Clock3,
  h_minus_1: Timer,
  overdue: AlertOctagon,
  closing: CalendarClock,
};

export function ReminderWidget({ items }: { items: ReminderItem[] }) {
  const [levelFilter, setLevelFilter] = useState<ReminderLevel | "all">("all");
  const [ackIds, setAckIds] = useState<Set<string>>(new Set());
  const [hideAcknowledged, setHideAcknowledged] = useState(true);

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (levelFilter !== "all" && item.level !== levelFilter) return false;
      if (hideAcknowledged && ackIds.has(item.id)) return false;
      return true;
    });
  }, [items, levelFilter, hideAcknowledged, ackIds]);

  const counts = useMemo(() => {
    return items.reduce(
      (acc, item) => {
        acc.total += 1;
        acc[item.level] += 1;
        if (ackIds.has(item.id)) acc.acknowledged += 1;
        return acc;
      },
      { total: 0, info: 0, warning: 0, critical: 0, acknowledged: 0 },
    );
  }, [items, ackIds]);

  function toggleAck(id: string) {
    setAckIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            Reminder Engine
          </CardTitle>
          <CardDescription>
            Notifikasi berbasis SLA dan cut-off — mengikuti Reminder Matrix per project.
          </CardDescription>
        </div>
        <div className="flex flex-col items-end gap-1 text-right">
          <div className="text-lg font-semibold tabular-nums">
            {counts.total - counts.acknowledged}
            <span className="ml-1 text-xs font-normal text-muted-foreground">/ {counts.total}</span>
          </div>
          <div className="text-[11px] text-muted-foreground">
            {counts.acknowledged} sudah diakuisisi
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Filter className="h-3 w-3" />
            Level
          </span>
          <FilterChip label={`Semua · ${counts.total}`} active={levelFilter === "all"} onClick={() => setLevelFilter("all")} />
          <FilterChip
            label={`Critical · ${counts.critical}`}
            active={levelFilter === "critical"}
            tone="danger"
            onClick={() => setLevelFilter("critical")}
          />
          <FilterChip
            label={`Warning · ${counts.warning}`}
            active={levelFilter === "warning"}
            tone="warning"
            onClick={() => setLevelFilter("warning")}
          />
          <FilterChip
            label={`Info · ${counts.info}`}
            active={levelFilter === "info"}
            tone="info"
            onClick={() => setLevelFilter("info")}
          />
          <label className="ml-auto inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-xs hover:bg-accent">
            <input
              type="checkbox"
              checked={hideAcknowledged}
              onChange={(e) => setHideAcknowledged(e.target.checked)}
              className="h-3 w-3 accent-primary"
            />
            <span>Sembunyikan yang sudah diakuisisi</span>
          </label>
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-md border border-dashed py-8 text-sm text-muted-foreground">
            <BellOff className="h-5 w-5" />
            Tidak ada reminder aktif untuk kriteria ini.
          </div>
        ) : (
          <ul className="space-y-2">
            {filtered.map((item) => {
              const meta = LEVEL_META[item.level];
              const TriggerIcon = TRIGGER_ICON[item.trigger];
              const acknowledged = ackIds.has(item.id);
              return (
                <li
                  key={item.id}
                  className={cn(
                    "flex flex-wrap items-start gap-3 rounded-lg border p-3 text-sm transition-colors",
                    meta.ringClass,
                    acknowledged && "opacity-60",
                  )}
                >
                  <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-md bg-white/60 text-foreground">
                    <TriggerIcon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={meta.variant} className="uppercase">
                        {meta.label}
                      </Badge>
                      <span className="text-[11px] font-medium text-muted-foreground">
                        {reminderTriggerLabel(item.trigger)}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        · notif {item.audience}
                      </span>
                    </div>
                    <div className="mt-1 text-sm font-medium">{item.title}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{item.detail}</div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="font-medium text-foreground">{item.target}</span>
                      <span>·</span>
                      <span>Due: {item.dueLabel}</span>
                      <span>·</span>
                      <span>Terjadwal {item.createdRelative}</span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant={acknowledged ? "ghost" : "outline"}
                    className="h-8"
                    onClick={() => toggleAck(item.id)}
                  >
                    <Check className="h-3.5 w-3.5" />
                    {acknowledged ? "Batalkan" : "Akuisisi"}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function FilterChip({
  label,
  active,
  tone,
  onClick,
}: {
  label: string;
  active: boolean;
  tone?: "info" | "warning" | "danger";
  onClick: () => void;
}) {
  const activeTone =
    tone === "danger"
      ? "border-rose-500 bg-rose-500 text-white"
      : tone === "warning"
        ? "border-amber-500 bg-amber-500 text-white"
        : tone === "info"
          ? "border-sky-500 bg-sky-500 text-white"
          : "border-primary bg-primary text-primary-foreground";
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
        active ? activeTone : "border-input bg-background hover:bg-accent",
      )}
    >
      {label}
    </button>
  );
}
