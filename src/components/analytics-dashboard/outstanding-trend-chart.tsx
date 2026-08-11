"use client";

import { useMemo } from "react";
import { formatCurrencyCompact } from "@/lib/utils";

const MONTHS = ["Mar", "Apr", "Mei", "Jun", "Jul", "Agu"];

export type OutstandingPoint = { month: string; outstanding: number };

/**
 * Build a deterministic 6-month outstanding-receivables trend from a base current
 * balance (usually the scoped portfolio's total aging balance). Seeded so it is
 * stable across renders; the last month equals the base. Frontend-first mock for
 * the Analytics Dashboard.
 */
export function buildOutstandingTrend(baseOutstanding: number): OutstandingPoint[] {
  const factors = [1.18, 1.1, 1.22, 1.05, 1.12, 1]; // relative to base, last = current
  return MONTHS.map((month, i) => ({
    month,
    outstanding: Math.round((baseOutstanding * factors[i]) / 1000) * 1000,
  }));
}

/**
 * Outstanding Trend — a line-style visualization of the outstanding receivables
 * balance over 6 months, drawn as connected points via an inline SVG polyline so
 * the movement reads clearly without a chart library. Presentational.
 */
export function OutstandingTrendChart({ data }: { data: OutstandingPoint[] }) {
  const { max, min } = useMemo(() => {
    const vals = data.map((d) => d.outstanding);
    return { max: Math.max(1, ...vals), min: Math.min(...vals) };
  }, [data]);

  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Tidak ada data.</p>;
  }

  const W = 100;
  const H = 100;
  const range = Math.max(1, max - min);
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - ((d.outstanding - min) / range) * (H - 12) - 6;
    return { x, y };
  });
  const polyline = points.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <div>
      <div className="relative" style={{ height: 180 }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <polyline points={polyline} fill="none" stroke="hsl(215 90% 55%)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
          {points.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={1.6} fill="hsl(215 90% 45%)" vectorEffect="non-scaling-stroke" />
          ))}
        </svg>
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
        {data.map((d) => (
          <div key={d.month} className="flex flex-col items-center">
            <span className="font-medium text-foreground">{formatCurrencyCompact(d.outstanding)}</span>
            <span>{d.month}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
