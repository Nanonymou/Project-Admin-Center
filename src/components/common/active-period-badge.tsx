"use client";

import { CalendarRange, RotateCcw } from "lucide-react";
import { useGlobalFilters } from "@/components/providers/global-filter-provider";
import { DATE_PRESETS } from "@/lib/mock/filters";
import { daysBetween } from "@/lib/mock/site-kpi";
import { formatDate } from "@/lib/utils";

/**
 * Compact, self-contained badge that reflects the active global period and
 * offers a one-click reset. Safe to drop into any PageHeader `actions`.
 */
export function ActivePeriodBadge() {
  const { filters, reset } = useGlobalFilters();
  const presetLabel =
    DATE_PRESETS.find((p) => p.key === filters.preset)?.label ?? "Custom";
  const days = daysBetween(filters.from, filters.to);
  const scopeCount = filters.projects.length + filters.locations.length;
  const isDefault =
    filters.preset === "today" && filters.projects.length === 0 && filters.locations.length === 0;

  return (
    <div className="inline-flex items-center gap-2 rounded-md border bg-card px-2.5 py-1.5 text-xs">
      <CalendarRange className="h-3.5 w-3.5 text-primary" />
      <div className="leading-tight">
        <div className="flex items-center gap-1.5 font-medium">
          {presetLabel}
          {scopeCount > 0 && (
            <span className="rounded bg-primary px-1 py-0.5 text-[10px] font-semibold text-primary-foreground">
              {scopeCount} filter
            </span>
          )}
        </div>
        <div className="text-[11px] tabular-nums text-muted-foreground">
          {formatDate(filters.from)} — {formatDate(filters.to)} · {days} hari
        </div>
      </div>
      {!isDefault && (
        <button
          type="button"
          onClick={reset}
          className="ml-1 inline-flex h-6 w-6 items-center justify-center rounded hover:bg-accent"
          title="Reset filter global"
          aria-label="Reset filter"
        >
          <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      )}
    </div>
  );
}
