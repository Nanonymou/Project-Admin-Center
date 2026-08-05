"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  CheckCircle2,
  ClipboardCheck,
  ClipboardEdit,
  FileCheck,
  FileText,
  Filter,
  Radio,
  ShieldAlert,
  Upload,
  UserCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ACTIVITY_FEED, type ActivityFeedItem } from "@/lib/mock/activity";
import { cn } from "@/lib/utils";

type Props = {
  locationName?: string;
  projectCodes?: string[];
  limit?: number;
  showLocationChip?: boolean;
};

type StatusFilter = ActivityFeedItem["status"] | "all";

const STATUS_META: Record<
  ActivityFeedItem["status"],
  { label: string; variant: "info" | "success" | "warning" | "danger"; dot: string }
> = {
  info: { label: "Info", variant: "info", dot: "bg-sky-500" },
  success: { label: "Success", variant: "success", dot: "bg-emerald-500" },
  warning: { label: "Warning", variant: "warning", dot: "bg-amber-500" },
  danger: { label: "Alert", variant: "danger", dot: "bg-rose-500" },
};

const STATUS_ORDER: ActivityFeedItem["status"][] = ["danger", "warning", "info", "success"];

const ACTION_ICONS: Array<{ match: RegExp; icon: React.ComponentType<{ className?: string }> }> = [
  { match: /approve/i, icon: UserCheck },
  { match: /reject/i, icon: ShieldAlert },
  { match: /submit/i, icon: ClipboardCheck },
  { match: /input/i, icon: ClipboardEdit },
  { match: /upload/i, icon: Upload },
  { match: /invoice/i, icon: FileText },
  { match: /sla/i, icon: ShieldAlert },
  { match: /lock/i, icon: FileCheck },
];

function iconFor(action: string): React.ComponentType<{ className?: string }> {
  for (const { match, icon } of ACTION_ICONS) {
    if (match.test(action)) return icon;
  }
  return Radio;
}

export function RecentActivityList({
  locationName,
  projectCodes,
  limit,
  showLocationChip = true,
}: Props) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [ackIds, setAckIds] = useState<Set<string>>(new Set());

  const scopedFeed = useMemo(() => {
    return ACTIVITY_FEED.filter((item) => {
      if (locationName && item.location !== locationName) return false;
      if (projectCodes && projectCodes.length > 0 && !projectCodes.includes(item.project)) return false;
      return true;
    });
  }, [locationName, projectCodes]);

  const counts = useMemo(() => {
    const acc: Record<StatusFilter, number> = {
      all: scopedFeed.length,
      info: 0,
      success: 0,
      warning: 0,
      danger: 0,
    };
    for (const item of scopedFeed) acc[item.status] += 1;
    return acc;
  }, [scopedFeed]);

  const filtered = useMemo(() => {
    return scopedFeed.filter((item) => {
      if (statusFilter !== "all" && item.status !== statusFilter) return false;
      return true;
    });
  }, [scopedFeed, statusFilter]);

  const shown = limit ? filtered.slice(0, limit) : filtered;

  function toggleAck(id: string) {
    setAckIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-md border bg-card p-2">
        <span className="inline-flex items-center gap-1 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Filter className="h-3 w-3" />
          Status
        </span>
        <ChipButton label={`Semua · ${counts.all}`} active={statusFilter === "all"} onClick={() => setStatusFilter("all")} />
        {STATUS_ORDER.map((s) => (
          <ChipButton
            key={s}
            label={`${STATUS_META[s].label} · ${counts[s]}`}
            active={statusFilter === s}
            tone={STATUS_META[s].variant}
            onClick={() => setStatusFilter(s)}
          />
        ))}
        <div className="ml-auto text-[11px] text-muted-foreground">
          {filtered.length} aktivitas · {ackIds.size} ditandai selesai
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-md border border-dashed py-8 text-sm text-muted-foreground">
          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          Tidak ada aktivitas cocok dengan filter aktif.
        </div>
      ) : (
        <ol className="space-y-2">
          {shown.map((item) => {
            const meta = STATUS_META[item.status];
            const Icon = iconFor(item.action);
            const acknowledged = ackIds.has(item.id);
            return (
              <li
                key={item.id}
                className={cn(
                  "flex flex-wrap items-start gap-3 rounded-md border p-3 text-sm transition-colors hover:bg-accent/40",
                  acknowledged && "opacity-60",
                )}
              >
                <div className="relative mt-0.5 flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                  <Icon className="h-4 w-4 text-foreground" />
                  <span className={cn("absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full ring-2 ring-background", meta.dot)} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{item.action}</span>
                    <span className="truncate text-xs text-muted-foreground">· {item.target}</span>
                    <Badge variant={meta.variant} className="ml-1">
                      {meta.label}
                    </Badge>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    <span>{item.actor}</span>
                    <span>·</span>
                    <span>{item.time}</span>
                    {showLocationChip && (
                      <>
                        <Badge variant="outline" className="ml-1 h-5 px-1.5">
                          {item.project}
                        </Badge>
                        <Badge variant="muted" className="h-5 px-1.5">
                          {item.location}
                        </Badge>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => toggleAck(item.id)}
                    className={cn(
                      "inline-flex h-7 items-center gap-1 rounded-md border px-2 text-xs font-medium",
                      acknowledged
                        ? "border-emerald-500 bg-emerald-500 text-white"
                        : "border-input bg-background hover:bg-accent",
                    )}
                    title={acknowledged ? "Batalkan tanda selesai" : "Tandai selesai"}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {acknowledged ? "Selesai" : "Tandai"}
                  </button>
                  {locationName ? null : (
                    <Link
                      href={`/activity`}
                      className="inline-flex items-center gap-0.5 text-xs font-medium text-primary hover:underline"
                    >
                      Feed
                      <ArrowUpRight className="h-3 w-3" />
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
      {limit && filtered.length > shown.length && (
        <div className="text-center text-[11px] text-muted-foreground">
          Menampilkan {shown.length} dari {filtered.length} aktivitas ·
          <Link href="/activity" className="ml-1 font-medium text-primary hover:underline">
            lihat semua di Activity Dashboard
          </Link>
        </div>
      )}
    </div>
  );
}

function ChipButton({
  label,
  active,
  tone,
  onClick,
}: {
  label: string;
  active: boolean;
  tone?: "info" | "success" | "warning" | "danger";
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
