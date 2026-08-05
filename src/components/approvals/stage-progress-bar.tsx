"use client";

import { Check } from "lucide-react";
import type { StageProgress } from "@/lib/mock/approval-progress";
import { cn, formatCurrencyCompact } from "@/lib/utils";

export function StageProgressBar({ stages }: { stages: StageProgress[] }) {
  const maxTotal = stages.reduce((m, s) => Math.max(m, s.total), 0) || 1;
  return (
    <div className="space-y-3">
      <ol className="flex flex-col gap-2 sm:flex-row sm:items-stretch sm:gap-1.5">
        {stages.map((s, i) => (
          <li key={s.stage} className="flex-1">
            <div className="flex h-full flex-col rounded-md border p-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Stage {i + 1}
                </span>
                <span className="text-[11px] tabular-nums text-muted-foreground">{s.total} inv</span>
              </div>
              <div className="mt-1 text-sm font-medium">{s.stage}</div>
              <div className="mt-2 flex h-2 overflow-hidden rounded bg-muted">
                {s.onTime > 0 && (
                  <div className="h-full bg-emerald-500" style={{ flex: s.onTime }} title={`On time: ${s.onTime}`} />
                )}
                {s.atRisk > 0 && (
                  <div className="h-full bg-amber-500" style={{ flex: s.atRisk }} title={`At risk: ${s.atRisk}`} />
                )}
                {s.overdue > 0 && (
                  <div className="h-full bg-rose-500" style={{ flex: s.overdue }} title={`Overdue: ${s.overdue}`} />
                )}
                {s.total === 0 && <div className="h-full w-full bg-muted" />}
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px] tabular-nums text-muted-foreground">
                <span>{formatCurrencyCompact(s.amount)}</span>
                <span
                  className={cn(
                    "inline-flex items-center gap-0.5",
                    s.overdue > 0 ? "text-rose-600" : s.atRisk > 0 ? "text-amber-600" : "text-emerald-600",
                  )}
                >
                  {s.overdue > 0
                    ? `${s.overdue} overdue`
                    : s.atRisk > 0
                      ? `${s.atRisk} at risk`
                      : s.total > 0
                        ? "sehat"
                        : "kosong"}
                </span>
              </div>
              <div className="mt-2 h-1 rounded bg-muted">
                <div
                  className="h-full rounded bg-primary/60"
                  style={{ width: `${(s.total / maxTotal) * 100}%` }}
                />
              </div>
            </div>
          </li>
        ))}
        <li className="flex-1">
          <div className="flex h-full flex-col items-center justify-center rounded-md border border-emerald-200 bg-emerald-50 p-3 text-center">
            <Check className="h-5 w-5 text-emerald-600" />
            <div className="mt-1 text-sm font-medium text-emerald-800">Settled</div>
            <div className="text-[11px] text-emerald-700">Stage akhir</div>
          </div>
        </li>
      </ol>
    </div>
  );
}
