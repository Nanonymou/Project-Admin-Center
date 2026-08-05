"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlarmClock,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Filter,
  Timer,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  KIND_META,
  STATUS_META,
  type DeadlineItem,
  type DeadlineStatus,
} from "@/lib/mock/deadlines";
import { cn } from "@/lib/utils";

type Props = {
  items: DeadlineItem[];
  showLocationColumn?: boolean;
  emptyLabel?: string;
};

const STATUS_ORDER: DeadlineStatus[] = ["overdue", "due_today", "due_soon", "on_track", "settled"];

export function DeadlineList({ items, showLocationColumn = true, emptyLabel }: Props) {
  const [statusFilter, setStatusFilter] = useState<DeadlineStatus | "all">("all");

  const counts = useMemo(() => {
    const acc: Record<DeadlineStatus | "all", number> = {
      all: items.length,
      overdue: 0,
      due_today: 0,
      due_soon: 0,
      on_track: 0,
      settled: 0,
    };
    for (const item of items) acc[item.status] += 1;
    return acc;
  }, [items]);

  const grouped = useMemo(() => {
    const filtered = statusFilter === "all" ? items : items.filter((i) => i.status === statusFilter);
    const groups: Record<DeadlineStatus, DeadlineItem[]> = {
      overdue: [],
      due_today: [],
      due_soon: [],
      on_track: [],
      settled: [],
    };
    for (const item of filtered) groups[item.status].push(item);
    return groups;
  }, [items, statusFilter]);

  const total = items.length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-md border bg-card p-2">
        <span className="inline-flex items-center gap-1 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Filter className="h-3 w-3" />
          Status
        </span>
        <StatusChip
          label={`Semua · ${counts.all}`}
          active={statusFilter === "all"}
          onClick={() => setStatusFilter("all")}
        />
        {STATUS_ORDER.map((s) => (
          <StatusChip
            key={s}
            label={`${STATUS_META[s].label} · ${counts[s]}`}
            active={statusFilter === s}
            tone={STATUS_META[s].variant}
            onClick={() => setStatusFilter(s)}
          />
        ))}
        <div className="ml-auto text-[11px] text-muted-foreground">
          {total} deadline dari {items.length} entri
        </div>
      </div>

      {total === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-md border border-dashed py-8 text-sm text-muted-foreground">
          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          {emptyLabel ?? "Tidak ada deadline aktif dalam scope Anda."}
        </div>
      ) : (
        STATUS_ORDER.filter((s) => grouped[s].length > 0).map((status) => (
          <DeadlineGroup
            key={status}
            status={status}
            items={grouped[status]}
            showLocationColumn={showLocationColumn}
          />
        ))
      )}
    </div>
  );
}

function DeadlineGroup({
  status,
  items,
  showLocationColumn,
}: {
  status: DeadlineStatus;
  items: DeadlineItem[];
  showLocationColumn: boolean;
}) {
  const [open, setOpen] = useState(status !== "settled" && status !== "on_track");
  const meta = STATUS_META[status];
  return (
    <div className="overflow-hidden rounded-md border">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 border-b bg-muted/30 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide"
      >
        <span className="inline-flex items-center gap-2">
          <StatusIcon status={status} />
          <Badge variant={meta.variant}>{meta.label}</Badge>
          <span className="text-[11px] font-medium text-muted-foreground">
            {items.length} item
          </span>
        </span>
        <ChevronDown
          className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-background text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 text-left font-medium">Deadline</th>
                {showLocationColumn && (
                  <th className="px-3 py-2 text-left font-medium">Site</th>
                )}
                <th className="px-3 py-2 text-left font-medium">Owner</th>
                <th className="px-3 py-2 text-left font-medium">Due</th>
                <th className="px-3 py-2 text-left font-medium">Progress</th>
                <th className="px-3 py-2 text-right font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-3 py-2">
                    <div className="text-sm font-medium">{item.title}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {KIND_META[item.kind].label} · {item.target}
                    </div>
                  </td>
                  {showLocationColumn && (
                    <td className="px-3 py-2 text-muted-foreground">
                      <div className="text-sm">{item.locationName}</div>
                      <div className="text-[11px]">{item.projectCode}</div>
                    </td>
                  )}
                  <td className="px-3 py-2 text-muted-foreground">{item.owner}</td>
                  <td className="px-3 py-2">
                    <div className="text-sm tabular-nums">{item.dueDate}</div>
                    <div
                      className={cn(
                        "text-[11px] tabular-nums",
                        item.status === "overdue" && "font-medium text-rose-600",
                        item.status === "due_today" && "font-medium text-amber-600",
                        item.status === "due_soon" && "text-amber-600",
                        item.status === "on_track" && "text-muted-foreground",
                        item.status === "settled" && "text-emerald-600",
                      )}
                    >
                      {item.dueLabel}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-24 overflow-hidden rounded bg-muted">
                        <div
                          className={
                            item.progressPct >= 80
                              ? "h-full bg-emerald-500"
                              : item.progressPct >= 50
                                ? "h-full bg-sky-500"
                                : "h-full bg-amber-500"
                          }
                          style={{ width: `${item.progressPct}%` }}
                        />
                      </div>
                      <span className="text-[11px] tabular-nums text-muted-foreground">
                        {item.progressPct}%
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Link
                      href={`/site/${item.locationId}`}
                      className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                    >
                      Detail
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatusChip({
  label,
  active,
  tone,
  onClick,
}: {
  label: string;
  active: boolean;
  tone?: "success" | "warning" | "danger" | "info" | "muted";
  onClick: () => void;
}) {
  const activeTone =
    tone === "danger"
      ? "border-rose-500 bg-rose-500 text-white"
      : tone === "warning"
        ? "border-amber-500 bg-amber-500 text-white"
        : tone === "success"
          ? "border-emerald-500 bg-emerald-500 text-white"
          : tone === "info"
            ? "border-sky-500 bg-sky-500 text-white"
            : "border-primary bg-primary text-primary-foreground";
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md border px-2 py-1 text-[11px] font-medium transition-colors",
        active ? activeTone : "border-input bg-background hover:bg-accent",
      )}
    >
      {label}
    </button>
  );
}

function StatusIcon({ status }: { status: DeadlineStatus }) {
  const cls = "h-3.5 w-3.5";
  if (status === "overdue") return <AlarmClock className={cn(cls, "text-rose-600")} />;
  if (status === "due_today") return <Timer className={cn(cls, "text-amber-600")} />;
  if (status === "due_soon") return <CalendarClock className={cn(cls, "text-amber-600")} />;
  if (status === "settled") return <CheckCircle2 className={cn(cls, "text-emerald-600")} />;
  return <CalendarClock className={cn(cls, "text-sky-600")} />;
}
