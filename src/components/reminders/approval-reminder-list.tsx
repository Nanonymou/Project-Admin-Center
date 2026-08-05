"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertOctagon,
  ArrowUpRight,
  Check,
  Clock,
  Filter,
  ShieldCheck,
  X,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  APPROVAL_STATUS_META,
  type ApprovalReminder,
  type ApprovalReminderPriority,
  type ApprovalReminderStatus,
} from "@/lib/mock/approvals";
import { cn, formatCurrency } from "@/lib/utils";

type Props = {
  items: ApprovalReminder[];
  compact?: boolean;
  showLocationColumn?: boolean;
};

const STATUS_ORDER: ApprovalReminderStatus[] = [
  "escalation",
  "overdue",
  "at_risk",
  "on_time",
  "approved",
];

const PRIORITY_META: Record<
  ApprovalReminderPriority,
  { label: string; color: string; icon: React.ComponentType<{ className?: string }> }
> = {
  high: { label: "High", color: "bg-rose-100 text-rose-800", icon: Zap },
  medium: { label: "Medium", color: "bg-amber-100 text-amber-800", icon: Clock },
  low: { label: "Low", color: "bg-slate-100 text-slate-700", icon: ShieldCheck },
};

export function ApprovalReminderList({ items, compact, showLocationColumn = true }: Props) {
  const [statusFilter, setStatusFilter] = useState<ApprovalReminderStatus | "all">("all");
  const [priorityFilter, setPriorityFilter] = useState<ApprovalReminderPriority | "all">("all");
  const [handled, setHandled] = useState<Record<string, "approved" | "rejected" | null>>({});

  const counts = useMemo(() => {
    const acc: Record<ApprovalReminderStatus | "all", number> = {
      all: items.length,
      escalation: 0,
      overdue: 0,
      at_risk: 0,
      on_time: 0,
      approved: 0,
    };
    for (const item of items) acc[item.status] += 1;
    return acc;
  }, [items]);

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (statusFilter !== "all" && item.status !== statusFilter) return false;
      if (priorityFilter !== "all" && item.priority !== priorityFilter) return false;
      return true;
    });
  }, [items, statusFilter, priorityFilter]);

  const handledCount = Object.values(handled).filter(Boolean).length;
  const shown = compact ? filtered.slice(0, 6) : filtered;

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-md border border-dashed py-8 text-sm text-muted-foreground">
        <ShieldCheck className="h-5 w-5 text-emerald-500" />
        Tidak ada approval yang menunggu tindakan.
      </div>
    );
  }

  function mark(id: string, decision: "approved" | "rejected") {
    setHandled((prev) => ({ ...prev, [id]: prev[id] === decision ? null : decision }));
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-md border bg-card p-2">
        <span className="inline-flex items-center gap-1 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Filter className="h-3 w-3" />
          Status
        </span>
        <FilterButton
          label={`Semua · ${counts.all}`}
          active={statusFilter === "all"}
          onClick={() => setStatusFilter("all")}
        />
        {STATUS_ORDER.map((s) => (
          <FilterButton
            key={s}
            label={`${APPROVAL_STATUS_META[s].label} · ${counts[s]}`}
            active={statusFilter === s}
            tone={APPROVAL_STATUS_META[s].variant}
            onClick={() => setStatusFilter(s)}
          />
        ))}
        <span className="ml-2 border-l pl-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Prioritas
        </span>
        {(["all", "high", "medium", "low"] as (ApprovalReminderPriority | "all")[]).map((p) => (
          <FilterButton
            key={p}
            label={p === "all" ? "Semua" : PRIORITY_META[p].label}
            active={priorityFilter === p}
            onClick={() => setPriorityFilter(p)}
          />
        ))}
        <span className="ml-auto text-[11px] text-muted-foreground">
          {filtered.length} dari {items.length} · {handledCount} sudah ditindaklanjuti
        </span>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2 text-left font-medium">Invoice</th>
              {showLocationColumn && (
                <th className="px-3 py-2 text-left font-medium">Site</th>
              )}
              <th className="px-3 py-2 text-left font-medium">Stage</th>
              <th className="px-3 py-2 text-left font-medium">Assignee</th>
              <th className="px-3 py-2 text-left font-medium">Status</th>
              <th className="px-3 py-2 text-left font-medium">SLA</th>
              <th className="px-3 py-2 text-right font-medium">Nilai</th>
              <th className="px-3 py-2 text-right font-medium">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 && (
              <tr>
                <td colSpan={showLocationColumn ? 8 : 7} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Tidak ada approval sesuai filter aktif.
                </td>
              </tr>
            )}
            {shown.map((item) => {
              const statusMeta = APPROVAL_STATUS_META[item.status];
              const priorityMeta = PRIORITY_META[item.priority];
              const PriorityIcon = priorityMeta.icon;
              const decision = handled[item.id];
              return (
                <tr
                  key={item.id}
                  className={cn(
                    "border-b last:border-0 hover:bg-muted/30",
                    decision === "approved" && "bg-emerald-50/40",
                    decision === "rejected" && "bg-rose-50/40",
                  )}
                >
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium tabular-nums">{item.invoiceNumber}</span>
                      <span
                        className={cn(
                          "inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                          priorityMeta.color,
                        )}
                      >
                        <PriorityIcon className="h-3 w-3" />
                        {priorityMeta.label}
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Submitted {item.submittedAt}
                    </div>
                  </td>
                  {showLocationColumn && (
                    <td className="px-3 py-2 text-muted-foreground">
                      <div className="text-sm">{item.locationName}</div>
                      <div className="text-[11px]">{item.projectCode}</div>
                    </td>
                  )}
                  <td className="px-3 py-2">
                    <div className="text-sm">{item.stage}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {item.timeInStageDays} hari di stage ini
                    </div>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{item.assignee}</td>
                  <td className="px-3 py-2">
                    <Badge variant={statusMeta.variant} className="inline-flex items-center gap-1">
                      {item.status === "escalation" && <AlertOctagon className="h-3 w-3" />}
                      {statusMeta.label}
                    </Badge>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-16 overflow-hidden rounded bg-muted">
                        <div
                          className={
                            item.timeInStageDays <= item.slaTargetDays * 0.7
                              ? "h-full bg-emerald-500"
                              : item.timeInStageDays <= item.slaTargetDays
                                ? "h-full bg-amber-500"
                                : "h-full bg-rose-500"
                          }
                          style={{
                            width: `${Math.min(
                              100,
                              Math.round((item.timeInStageDays / item.slaTargetDays) * 100),
                            )}%`,
                          }}
                        />
                      </div>
                      <span className="text-[11px] tabular-nums text-muted-foreground">
                        {item.timeInStageDays}/{item.slaTargetDays}h
                      </span>
                    </div>
                    <div className="mt-1 text-[11px] text-muted-foreground">{item.dueLabel}</div>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium">
                    {formatCurrency(item.amount)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="inline-flex items-center gap-1">
                      <Button
                        size="sm"
                        variant={decision === "approved" ? "default" : "outline"}
                        className="h-7 px-2"
                        onClick={() => mark(item.id, "approved")}
                        title="Approve"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant={decision === "rejected" ? "destructive" : "outline"}
                        className="h-7 px-2"
                        onClick={() => mark(item.id, "rejected")}
                        title="Reject"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                      <Link
                        href={`/site/${item.locationId}`}
                        className="ml-1 inline-flex items-center gap-0.5 text-xs font-medium text-primary hover:underline"
                      >
                        Detail
                        <ArrowUpRight className="h-3 w-3" />
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {compact && filtered.length > shown.length && (
        <div className="text-center text-[11px] text-muted-foreground">
          Menampilkan {shown.length} dari {filtered.length} approval — buka Leader Dashboard untuk daftar lengkap.
        </div>
      )}
    </div>
  );
}

function FilterButton({
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
