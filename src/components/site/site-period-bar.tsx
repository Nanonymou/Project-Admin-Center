"use client";

import { useState } from "react";
import { CalendarDays, ChevronDown, ChevronUp, RotateCcw, Sliders } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGlobalFilters } from "@/components/providers/global-filter-provider";
import {
  DATE_PRESETS,
  rangeForPreset,
  type DatePresetKey,
} from "@/lib/mock/filters";
import { PeriodPicker, type PeriodMode, type PeriodValue } from "@/components/common/period-picker";
import { cn } from "@/lib/utils";

function inferMode(from: string, to: string): PeriodMode {
  const f = new Date(from);
  const t = new Date(to);
  const monthStart = f.getDate() === 1;
  const monthEnd = new Date(t.getFullYear(), t.getMonth() + 1, 0).toISOString().slice(0, 10) === to;
  const sameMonth = f.getFullYear() === t.getFullYear() && f.getMonth() === t.getMonth();
  const yearStart = monthStart && f.getMonth() === 0;
  const yearEnd = t.getMonth() === 11 && new Date(t.getFullYear(), 11, 31).toISOString().slice(0, 10) === to;
  const sameYear = f.getFullYear() === t.getFullYear();
  if (yearStart && yearEnd && sameYear) return "year";
  if (sameMonth && monthStart && monthEnd) return "month";
  return "day";
}

export function SitePeriodBar({ scopedInfo }: { scopedInfo: string }) {
  const { filters, setFilters, reset } = useGlobalFilters();
  const [showPicker, setShowPicker] = useState(false);

  function pickPreset(p: DatePresetKey) {
    if (p === "custom") {
      setFilters({ ...filters, preset: p });
      setShowPicker(true);
      return;
    }
    const r = rangeForPreset(p);
    setFilters({ ...filters, preset: p, ...r });
  }

  const isDefault = filters.preset === "today";
  const pickerValue: PeriodValue = {
    from: filters.from,
    to: filters.to,
    mode: inferMode(filters.from, filters.to),
  };

  return (
    <div className="space-y-2 rounded-lg border bg-card p-3">
      <div className="flex flex-wrap items-center gap-2">
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
        <Button
          size="sm"
          variant={showPicker ? "default" : "outline"}
          className="h-7"
          onClick={() => setShowPicker((s) => !s)}
        >
          <Sliders className="h-3.5 w-3.5" />
          Pemilih Detail
          {showPicker ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </Button>
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
      {showPicker && (
        <PeriodPicker
          value={pickerValue}
          onChange={(next) =>
            setFilters({
              ...filters,
              preset: "custom",
              from: next.from,
              to: next.to,
            })
          }
        />
      )}
    </div>
  );
}
