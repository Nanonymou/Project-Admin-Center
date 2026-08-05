"use client";

import { CalendarDays, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGlobalFilters } from "@/components/providers/global-filter-provider";
import {
  DATE_PRESETS,
  rangeForPreset,
  type DatePresetKey,
} from "@/lib/mock/filters";
import { cn } from "@/lib/utils";

export function SitePeriodBar({ scopedInfo }: { scopedInfo: string }) {
  const { filters, setFilters, reset } = useGlobalFilters();

  function pickPreset(p: DatePresetKey) {
    if (p === "custom") {
      setFilters({ ...filters, preset: p });
      return;
    }
    const r = rangeForPreset(p);
    setFilters({ ...filters, preset: p, ...r });
  }

  const isCustom = filters.preset === "custom";
  const isDefault = filters.preset === "today";

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3">
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <CalendarDays className="h-3.5 w-3.5" />
        Periode Global
      </span>
      {DATE_PRESETS.map((p) => (
        <button
          key={p.key}
          type="button"
          onClick={() => pickPreset(p.key)}
          className={cn(
            "rounded-md border px-2 py-1 text-[11px] font-medium transition-colors",
            filters.preset === p.key
              ? "border-primary bg-primary text-primary-foreground"
              : "border-input bg-background hover:bg-accent",
          )}
        >
          {p.label}
        </button>
      ))}
      {isCustom && (
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={filters.from}
            max={filters.to}
            onChange={(e) => setFilters({ ...filters, from: e.target.value })}
            className="h-7 rounded-md border bg-background px-2 text-xs"
          />
          <span className="text-xs text-muted-foreground">→</span>
          <input
            type="date"
            value={filters.to}
            min={filters.from}
            onChange={(e) => setFilters({ ...filters, to: e.target.value })}
            className="h-7 rounded-md border bg-background px-2 text-xs"
          />
        </div>
      )}
      <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
        <span>
          {filters.from} → {filters.to} · {scopedInfo}
        </span>
        {!isDefault && (
          <Button size="sm" variant="ghost" className="h-7" onClick={reset}>
            <RotateCcw className="h-3 w-3" />
            Reset
          </Button>
        )}
      </div>
    </div>
  );
}
