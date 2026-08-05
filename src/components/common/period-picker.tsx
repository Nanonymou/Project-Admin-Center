"use client";

import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type PeriodMode = "day" | "month" | "year";

export type PeriodValue = {
  from: string; // ISO date
  to: string; // ISO date
  mode: PeriodMode;
};

type Props = {
  value: PeriodValue;
  onChange: (next: PeriodValue) => void;
  className?: string;
};

const MONTHS_ID = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

const MODE_LABEL: Record<PeriodMode, string> = {
  day: "Tanggal",
  month: "Bulan",
  year: "Tahun",
};

function toIso(d: Date) {
  return d.toISOString().slice(0, 10);
}

function monthRange(year: number, month: number) {
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  return { from: toIso(start), to: toIso(end) };
}

function yearRange(year: number) {
  const start = new Date(year, 0, 1);
  const end = new Date(year, 11, 31);
  return { from: toIso(start), to: toIso(end) };
}

/**
 * A three-mode period picker: Day (from/to inputs), Month (grid of 12
 * months with year navigation), Year (grid of 12 years). Fully controlled
 * — parent decides how to persist the selection.
 */
export function PeriodPicker({ value, onChange, className }: Props) {
  const [pivot, setPivot] = useState<Date>(() => new Date(value.from));

  const currentYear = pivot.getFullYear();
  const currentMonth = pivot.getMonth();

  const yearsWindow = useMemo(() => {
    const base = Math.floor(currentYear / 12) * 12;
    return Array.from({ length: 12 }, (_, i) => base + i);
  }, [currentYear]);

  const activeMonth = useMemo(() => {
    const from = new Date(value.from);
    return { year: from.getFullYear(), month: from.getMonth() };
  }, [value.from]);

  return (
    <div className={cn("space-y-3 rounded-lg border bg-card p-3", className)}>
      <div className="flex items-center justify-between gap-2">
        <div className="inline-flex items-center gap-1 rounded-md border p-0.5 text-xs">
          {(Object.keys(MODE_LABEL) as PeriodMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                if (m === "day") return onChange({ ...value, mode: "day" });
                if (m === "month") {
                  const r = monthRange(currentYear, currentMonth);
                  return onChange({ mode: "month", ...r });
                }
                const r = yearRange(currentYear);
                return onChange({ mode: "year", ...r });
              }}
              className={cn(
                "rounded-sm px-2 py-1 text-xs font-medium transition-colors",
                value.mode === m
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent text-muted-foreground",
              )}
            >
              {MODE_LABEL[m]}
            </button>
          ))}
        </div>
        <div className="inline-flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => setPivot(new Date(currentYear - (value.mode === "year" ? 12 : 1), currentMonth, 1))}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <span className="min-w-[7ch] text-center text-xs font-semibold">
            {value.mode === "year"
              ? `${yearsWindow[0]}–${yearsWindow[yearsWindow.length - 1]}`
              : currentYear}
          </span>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => setPivot(new Date(currentYear + (value.mode === "year" ? 12 : 1), currentMonth, 1))}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {value.mode === "day" && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border p-2">
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
          <div className="ml-auto text-[11px] text-muted-foreground">
            Pilih rentang tanggal bebas.
          </div>
        </div>
      )}

      {value.mode === "month" && (
        <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
          {MONTHS_ID.map((label, idx) => {
            const isActive = activeMonth.year === currentYear && activeMonth.month === idx;
            return (
              <button
                key={label}
                type="button"
                onClick={() => {
                  const r = monthRange(currentYear, idx);
                  onChange({ mode: "month", ...r });
                }}
                className={cn(
                  "rounded-md border py-2 text-xs font-medium transition-colors",
                  isActive
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-background hover:bg-accent",
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      {value.mode === "year" && (
        <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
          {yearsWindow.map((yr) => {
            const isActive = activeMonth.year === yr && value.mode === "year";
            return (
              <button
                key={yr}
                type="button"
                onClick={() => {
                  const r = yearRange(yr);
                  onChange({ mode: "year", ...r });
                }}
                className={cn(
                  "rounded-md border py-2 text-xs font-medium tabular-nums transition-colors",
                  isActive
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-background hover:bg-accent",
                )}
              >
                {yr}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-between border-t pt-2 text-[11px] text-muted-foreground">
        <span>
          Rentang aktif: <b className="text-foreground tabular-nums">{value.from} → {value.to}</b>
        </span>
        <span className="uppercase tracking-wide">Mode: {MODE_LABEL[value.mode]}</span>
      </div>
    </div>
  );
}
