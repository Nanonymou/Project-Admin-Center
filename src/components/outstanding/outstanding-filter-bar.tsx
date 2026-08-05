"use client";

import { CalendarDays, MapPin, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGlobalFilters } from "@/components/providers/global-filter-provider";
import {
  DATE_PRESETS,
  rangeForPreset,
  type DatePresetKey,
  type LocationOption,
} from "@/lib/mock/filters";
import { cn } from "@/lib/utils";

type Props = {
  locations: LocationOption[];
  matchedCount: number;
};

/**
 * Compact site+period filter dedicated to the Outstanding Invoice list.
 * Writes into the global filter provider so choices flow to other pages.
 */
export function OutstandingFilterBar({ locations, matchedCount }: Props) {
  const { filters, setFilters, reset } = useGlobalFilters();

  function pickPreset(preset: DatePresetKey) {
    if (preset === "custom") {
      setFilters({ ...filters, preset });
      return;
    }
    const r = rangeForPreset(preset);
    setFilters({ ...filters, preset, ...r });
  }

  function toggleLocation(id: string) {
    const isActive = filters.locations.includes(id);
    setFilters({
      ...filters,
      locations: isActive
        ? filters.locations.filter((l) => l !== id)
        : [...filters.locations, id],
    });
  }

  const isCustom = filters.preset === "custom";

  const groupedByProject = locations.reduce<Record<string, LocationOption[]>>((acc, loc) => {
    acc[loc.projectCode] = acc[loc.projectCode] ?? [];
    acc[loc.projectCode].push(loc);
    return acc;
  }, {});

  return (
    <div className="space-y-3 rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <CalendarDays className="h-3.5 w-3.5" />
          Periode
        </span>
        {DATE_PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => pickPreset(p.key)}
            className={cn(
              "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
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
              className="h-8 rounded-md border bg-background px-2 text-xs"
            />
            <span className="text-xs text-muted-foreground">→</span>
            <input
              type="date"
              value={filters.to}
              min={filters.from}
              onChange={(e) => setFilters({ ...filters, to: e.target.value })}
              className="h-8 rounded-md border bg-background px-2 text-xs"
            />
          </div>
        )}
        <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
          <span>
            {filters.from} → {filters.to} · <b className="text-foreground">{matchedCount}</b> invoice
          </span>
          <Button size="sm" variant="ghost" className="h-8" onClick={reset}>
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </Button>
        </div>
      </div>

      <div className="rounded-md border bg-background p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" />
            Site
          </span>
          <span className="text-[11px] text-muted-foreground">
            {filters.locations.length === 0
              ? "Semua site aktif"
              : `${filters.locations.length} site dipilih`}
          </span>
        </div>
        {Object.keys(groupedByProject).length === 0 ? (
          <span className="text-xs italic text-muted-foreground">
            Tidak ada site dalam scope.
          </span>
        ) : (
          <div className="space-y-2">
            {Object.entries(groupedByProject).map(([project, locs]) => (
              <div key={project} className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-semibold text-muted-foreground">{project}</span>
                {locs.map((loc) => {
                  const active = filters.locations.includes(loc.id);
                  return (
                    <button
                      key={loc.id}
                      type="button"
                      onClick={() => toggleLocation(loc.id)}
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                        active
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-input bg-background hover:bg-accent",
                      )}
                    >
                      {loc.name}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
