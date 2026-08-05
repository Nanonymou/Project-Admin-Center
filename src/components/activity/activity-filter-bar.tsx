"use client";

import { useMemo } from "react";
import { CalendarDays, Filter, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DATE_PRESETS,
  LOCATION_OPTIONS as ALL_LOCATION_OPTIONS,
  PROJECT_OPTIONS as ALL_PROJECT_OPTIONS,
  rangeForPreset,
  type ActivityFilterState,
  type DatePresetKey,
  type LocationOption,
  type ProjectOption,
} from "@/lib/mock/filters";

type Props = {
  value: ActivityFilterState;
  onChange: (next: ActivityFilterState) => void;
  onReset: () => void;
  matchedCount: number;
  projectOptions?: ProjectOption[];
  locationOptions?: LocationOption[];
};

export function ActivityFilterBar({
  value,
  onChange,
  onReset,
  matchedCount,
  projectOptions = ALL_PROJECT_OPTIONS,
  locationOptions = ALL_LOCATION_OPTIONS,
}: Props) {
  const availableLocations = useMemo(() => {
    if (value.projects.length === 0) return locationOptions;
    return locationOptions.filter((l) => value.projects.includes(l.projectCode));
  }, [value.projects, locationOptions]);

  function handlePreset(preset: DatePresetKey) {
    if (preset === "custom") {
      onChange({ ...value, preset });
      return;
    }
    const range = rangeForPreset(preset);
    onChange({ ...value, preset, ...range });
  }

  function toggleProject(code: string) {
    const isActive = value.projects.includes(code);
    const nextProjects = isActive
      ? value.projects.filter((p) => p !== code)
      : [...value.projects, code];
    const stillValidLocations = value.locations.filter((locId) =>
      locationOptions.some(
        (l) => l.id === locId && (nextProjects.length === 0 || nextProjects.includes(l.projectCode)),
      ),
    );
    onChange({ ...value, projects: nextProjects, locations: stillValidLocations });
  }

  function toggleLocation(id: string) {
    const isActive = value.locations.includes(id);
    onChange({
      ...value,
      locations: isActive
        ? value.locations.filter((l) => l !== id)
        : [...value.locations, id],
    });
  }

  const isCustom = value.preset === "custom";
  const hasFilters =
    value.projects.length > 0 ||
    value.locations.length > 0 ||
    value.preset !== "today";

  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Filter className="h-4 w-4 text-muted-foreground" />
          Filter
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {DATE_PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => handlePreset(p.key)}
              className={cn(
                "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                value.preset === p.key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input bg-background hover:bg-accent",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        {isCustom && (
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <input
              type="date"
              value={value.from}
              max={value.to}
              onChange={(e) => onChange({ ...value, from: e.target.value })}
              className="h-8 rounded-md border bg-background px-2 text-xs"
            />
            <span className="text-xs text-muted-foreground">→</span>
            <input
              type="date"
              value={value.to}
              min={value.from}
              onChange={(e) => onChange({ ...value, to: e.target.value })}
              className="h-8 rounded-md border bg-background px-2 text-xs"
            />
          </div>
        )}
        <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
          <span>
            <b className="text-foreground">{matchedCount}</b> site cocok
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={onReset}
            disabled={!hasFilters}
            className="h-8"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </Button>
        </div>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <FilterChipGroup
          label="Project"
          hint={value.projects.length === 0 ? "Semua project" : `${value.projects.length} dipilih`}
          items={projectOptions.map((p) => ({
            id: p.code,
            label: p.code,
            sublabel: p.name,
            active: value.projects.includes(p.code),
          }))}
          onToggle={toggleProject}
        />
        <FilterChipGroup
          label="Location"
          hint={value.locations.length === 0 ? "Semua location" : `${value.locations.length} dipilih`}
          items={availableLocations.map((l) => ({
            id: l.id,
            label: l.name,
            sublabel: l.projectCode,
            active: value.locations.includes(l.id),
          }))}
          onToggle={toggleLocation}
        />
      </div>
    </div>
  );
}

type ChipItem = { id: string; label: string; sublabel?: string; active: boolean };

function FilterChipGroup({
  label,
  hint,
  items,
  onToggle,
}: {
  label: string;
  hint: string;
  items: ChipItem[];
  onToggle: (id: string) => void;
}) {
  return (
    <div className="rounded-md border bg-background p-2.5">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span className="text-[11px] text-muted-foreground">{hint}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {items.length === 0 && (
          <span className="text-xs italic text-muted-foreground">
            Tidak ada opsi untuk project terpilih.
          </span>
        )}
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onToggle(item.id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
              item.active
                ? "border-primary bg-primary/10 text-primary"
                : "border-input bg-background hover:bg-accent",
            )}
          >
            {item.label}
            {item.sublabel && (
              <span className="text-[10px] font-normal text-muted-foreground">
                {item.sublabel}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
