"use client";

import { useMemo } from "react";
import { AlertTriangle, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type DaySubmission = {
  iso: string;
  label: string;
  weekday: string;
  submitted: boolean;
  isToday: boolean;
  isFuture: boolean;
};

/**
 * Last N days with submitted / missing status. `submittedIsos` marks the
 * dates that have an entry; everything else in the past is "missing".
 */
export function MissingSubmissionStrip({
  submittedIsos,
  days = 14,
}: {
  submittedIsos: string[];
  days?: number;
}) {
  const submittedSet = useMemo(() => new Set(submittedIsos), [submittedIsos]);

  const cells: DaySubmission[] = useMemo(() => {
    const todayIso = new Date().toISOString().slice(0, 10);
    return Array.from({ length: days }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (days - 1 - i));
      const iso = d.toISOString().slice(0, 10);
      return {
        iso,
        label: d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" }),
        weekday: d.toLocaleDateString("id-ID", { weekday: "short" }),
        submitted: submittedSet.has(iso),
        isToday: iso === todayIso,
        isFuture: iso > todayIso,
      };
    });
  }, [submittedSet, days]);

  const missingCount = cells.filter((c) => !c.submitted && !c.isFuture && !c.isToday).length;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium">
          {days} hari terakhir
        </span>
        {missingCount > 0 ? (
          <span className="inline-flex items-center gap-1 rounded bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700">
            <AlertTriangle className="h-3 w-3" />
            {missingCount} hari belum submit
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
            <Check className="h-3 w-3" />
            Lengkap
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {cells.map((c) => {
          const status = c.isFuture
            ? "future"
            : c.submitted
              ? "done"
              : c.isToday
                ? "today"
                : "missing";
          return (
            <div
              key={c.iso}
              className={cn(
                "flex w-11 flex-col items-center rounded-md border px-1 py-1.5 text-center",
                status === "done" && "border-emerald-200 bg-emerald-50 text-emerald-800",
                status === "missing" && "border-rose-200 bg-rose-50 text-rose-700",
                status === "today" && "border-primary bg-primary/10 text-primary",
                status === "future" && "border-input bg-muted/30 text-muted-foreground",
              )}
              title={`${c.label} — ${
                status === "done"
                  ? "sudah submit"
                  : status === "missing"
                    ? "belum submit"
                    : status === "today"
                      ? "hari ini"
                      : "akan datang"
              }`}
            >
              <span className="text-[9px] uppercase">{c.weekday}</span>
              <span className="text-[11px] font-semibold tabular-nums">{c.label.split(" ")[0]}</span>
              {status === "done" ? (
                <Check className="h-3 w-3" />
              ) : status === "missing" ? (
                <AlertTriangle className="h-3 w-3" />
              ) : (
                <span className="h-3 w-3" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
