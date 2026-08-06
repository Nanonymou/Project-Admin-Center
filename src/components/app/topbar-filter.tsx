"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarRange, ChevronDown, RotateCcw, SlidersHorizontal } from "lucide-react";
import { useGlobalFilters } from "@/components/providers/global-filter-provider";
import { usePersona } from "@/components/providers/persona-provider";
import {
  DATE_PRESETS,
  LOCATION_OPTIONS,
  PROJECT_OPTIONS,
  rangeForPreset,
  type DatePresetKey,
} from "@/lib/mock/filters";
import { canAccessLocation } from "@/lib/personas";
import { cn } from "@/lib/utils";

/**
 * App-wide global filter control living in the top bar. Any page that reads
 * the global filter provider reflects changes made here.
 */
export function TopbarFilter() {
  const { filters, setFilters, reset } = useGlobalFilters();
  const { persona } = usePersona();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [open]);

  const presetLabel = DATE_PRESETS.find((p) => p.key === filters.preset)?.label ?? "Custom";
  const activeCount = filters.projects.length + filters.locations.length;

  const projectOptions = PROJECT_OPTIONS.filter((p) =>
    LOCATION_OPTIONS.some((l) => l.projectCode === p.code && canAccessLocation(persona, l.id, l.projectCode)),
  );
  const locationOptions = LOCATION_OPTIONS.filter((l) =>
    canAccessLocation(persona, l.id, l.projectCode),
  );
  const visibleLocations =
    filters.projects.length === 0
      ? locationOptions
      : locationOptions.filter((l) => filters.projects.includes(l.projectCode));

  function pickPreset(p: DatePresetKey) {
    if (p === "custom") return setFilters({ ...filters, preset: p });
    setFilters({ ...filters, preset: p, ...rangeForPreset(p) });
  }
  function toggleProject(code: string) {
    const active = filters.projects.includes(code);
    const nextProjects = active
      ? filters.projects.filter((p) => p !== code)
      : [...filters.projects, code];
    const nextLocations = filters.locations.filter((locId) =>
      LOCATION_OPTIONS.some(
        (l) => l.id === locId && (nextProjects.length === 0 || nextProjects.includes(l.projectCode)),
      ),
    );
    setFilters({ ...filters, projects: nextProjects, locations: nextLocations });
  }
  function toggleLocation(id: string) {
    const active = filters.locations.includes(id);
    setFilters({
      ...filters,
      locations: active ? filters.locations.filter((l) => l !== id) : [...filters.locations, id],
    });
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="hidden items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs hover:bg-accent lg:flex"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <SlidersHorizontal className="h-3.5 w-3.5 text-primary" />
        <span className="font-medium">{presetLabel}</span>
        {activeCount > 0 && (
          <span className="rounded bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
            {activeCount}
          </span>
        )}
        <ChevronDown className="h-3 w-3 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-40 mt-2 w-80 rounded-lg border bg-card p-3 shadow-lg">
          <div className="mb-2 flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <CalendarRange className="h-3.5 w-3.5" />
              Filter Global
            </span>
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="h-3 w-3" />
              Reset
            </button>
          </div>

          <div className="mb-2 flex flex-wrap gap-1.5">
            {DATE_PRESETS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => pickPreset(p.key)}
                className={cn(
                  "rounded-md border px-2 py-1 text-[11px] font-medium",
                  filters.preset === p.key
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-background hover:bg-accent",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          {filters.preset === "custom" && (
            <div className="mb-2 flex items-center gap-1.5">
              <input
                type="date"
                value={filters.from}
                max={filters.to}
                onChange={(e) => setFilters({ ...filters, from: e.target.value })}
                className="h-7 flex-1 rounded-md border bg-background px-2 text-[11px]"
              />
              <span className="text-[11px] text-muted-foreground">→</span>
              <input
                type="date"
                value={filters.to}
                min={filters.from}
                onChange={(e) => setFilters({ ...filters, to: e.target.value })}
                className="h-7 flex-1 rounded-md border bg-background px-2 text-[11px]"
              />
            </div>
          )}

          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Project
          </div>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {projectOptions.map((p) => (
              <button
                key={p.code}
                type="button"
                onClick={() => toggleProject(p.code)}
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[11px] font-medium",
                  filters.projects.includes(p.code)
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-input bg-background hover:bg-accent",
                )}
              >
                {p.code}
              </button>
            ))}
          </div>

          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Location
          </div>
          <div className="flex flex-wrap gap-1.5">
            {visibleLocations.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => toggleLocation(l.id)}
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[11px] font-medium",
                  filters.locations.includes(l.id)
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-input bg-background hover:bg-accent",
                )}
              >
                {l.name}
              </button>
            ))}
          </div>

          <div className="mt-2 border-t pt-2 text-[11px] text-muted-foreground">
            Aktif: {filters.from} → {filters.to}
          </div>
        </div>
      )}
    </div>
  );
}
