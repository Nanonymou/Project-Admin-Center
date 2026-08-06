"use client";

import { useMemo, useState } from "react";
import { Filter, History } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AUDIT_ACTION_META, type AuditAction, type AuditEntry } from "@/lib/mock/audit-trail";
import { cn } from "@/lib/utils";

const DOT: Record<AuditAction, string> = {
  create: "bg-muted-foreground/50",
  edit: "bg-sky-500",
  submit: "bg-sky-500",
  review: "bg-amber-500",
  approve: "bg-emerald-500",
  reject: "bg-rose-500",
  lock: "bg-emerald-600",
  unlock: "bg-amber-600",
  upload: "bg-sky-500",
  send: "bg-sky-500",
};

export function ChangeHistory({ entries }: { entries: AuditEntry[] }) {
  const [actionFilter, setActionFilter] = useState<AuditAction | "all">("all");

  const actions = useMemo(
    () => Array.from(new Set(entries.map((e) => e.action))),
    [entries],
  );

  const filtered = useMemo(
    () => (actionFilter === "all" ? entries : entries.filter((e) => e.action === actionFilter)),
    [entries, actionFilter],
  );

  if (entries.length === 0) {
    return (
      <div className="rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">
        Belum ada riwayat perubahan.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          <Filter className="h-3 w-3" />
          Aksi
        </span>
        <button
          type="button"
          onClick={() => setActionFilter("all")}
          className={cn(
            "rounded-md border px-2 py-1 text-xs font-medium",
            actionFilter === "all"
              ? "border-primary bg-primary text-primary-foreground"
              : "border-input bg-background hover:bg-accent",
          )}
        >
          Semua · {entries.length}
        </button>
        {actions.map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => setActionFilter(a)}
            className={cn(
              "rounded-md border px-2 py-1 text-xs font-medium",
              actionFilter === a
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input bg-background hover:bg-accent",
            )}
          >
            {AUDIT_ACTION_META[a].label}
          </button>
        ))}
      </div>

      <ol className="relative">
        {filtered.map((e, i) => (
          <li key={e.id} className="flex gap-3 py-2.5">
            <div className="relative mt-1 flex flex-col items-center">
              <span className={cn("h-2.5 w-2.5 rounded-full ring-4 ring-background", DOT[e.action])} />
              {i < filtered.length - 1 && <span className="mt-1 w-px flex-1 bg-border" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={AUDIT_ACTION_META[e.action].variant}>
                  {AUDIT_ACTION_META[e.action].label}
                </Badge>
                <span className="text-sm font-medium">{e.target}</span>
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">{e.detail}</div>
              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                <span>{e.actor}</span>
                <span>·</span>
                <span>{e.timeLabel}</span>
                <Badge variant="outline" className="ml-1 h-4 px-1">{e.projectCode}</Badge>
                <Badge variant="muted" className="h-4 px-1">{e.locationName}</Badge>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
