"use client";

import { useMemo } from "react";
import { ArrowUp, ArrowDown } from "lucide-react";
import { formatCurrencyCompact, cn } from "@/lib/utils";

const MONTHS = ["Mar", "Apr", "Mei", "Jun", "Jul", "Agu"];

export type RevenueGrowthPoint = { month: string; revenue: number; growthPct: number };

/**
 * Build a deterministic 6-month revenue series with month-over-month growth %
 * from a base current monthly revenue (usually the scoped portfolio's total
 * sales). Seeded so it is stable across renders; the last month equals the base.
 * Frontend-first mock for the Analytics Dashboard.
 */
export function buildRevenueGrowth(baseMonthly: number): RevenueGrowthPoint[] {
  // Walk backwards from the base applying gentle deterministic month deltas.
  const deltas = [0.06, -0.03, 0.09, 0.04, 0.07, 0]; // last delta 0 => current month
  const revenues: number[] = [];
  let value = baseMonthly;
  for (let i = MONTHS.length - 1; i >= 0; i--) {
    revenues[i] = Math.round(value / 1000) * 1000;
    // Previous month = current / (1 + delta_of_current)
    value = value / (1 + deltas[i]);
  }
  return MONTHS.map((month, i) => {
    const growthPct = i === 0 ? 0 : revenues[i - 1] > 0 ? ((revenues[i] - revenues[i - 1]) / revenues[i - 1]) * 100 : 0;
    return { month, revenue: revenues[i], growthPct };
  });
}

/**
 * Revenue Growth — monthly revenue bars with a month-over-month growth badge on
 * each. Lightweight (no chart library); presentational.
 */
export function RevenueGrowthChart({ data }: { data: RevenueGrowthPoint[] }) {
  const max = useMemo(() => Math.max(1, ...data.map((d) => d.revenue)), [data]);

  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Tidak ada data.</p>;
  }

  return (
    <div className="flex items-end gap-3" style={{ height: 210 }}>
      {data.map((d, i) => {
        const up = d.growthPct >= 0;
        return (
          <div key={d.month} className="flex flex-1 flex-col items-center gap-1">
            {i > 0 && (
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 text-[10px] font-medium",
                  up ? "text-emerald-600" : "text-rose-600",
                )}
              >
                {up ? <ArrowUp className="h-2.5 w-2.5" /> : <ArrowDown className="h-2.5 w-2.5" />}
                {Math.abs(d.growthPct).toFixed(1)}%
              </span>
            )}
            <div className="flex w-full flex-1 items-end">
              <div
                className="w-full rounded-t bg-indigo-500 transition-all hover:bg-indigo-600"
                style={{ height: `${(d.revenue / max) * 100}%` }}
                title={`${d.month}: ${formatCurrencyCompact(d.revenue)}`}
              />
            </div>
            <span className="text-[10px] text-muted-foreground">{d.month}</span>
          </div>
        );
      })}
    </div>
  );
}
