"use client";

import { useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ProfitTrendPoint } from "@/components/margin/profit-trend-chart";
import { cn, formatCurrency } from "@/lib/utils";

type Series = "sales" | "cost" | "profit";

const SERIES_META: Record<Series, { label: string; color: string }> = {
  sales: { label: "Sales", color: "hsl(221 83% 45%)" },
  cost: { label: "Cost", color: "hsl(38 92% 50%)" },
  profit: { label: "Profit", color: "hsl(142 71% 45%)" },
};

/**
 * Pure multi-line profit-over-time chart with per-series visibility toggles.
 */
export function ProfitLineChart({ data }: { data: ProfitTrendPoint[] }) {
  const [hidden, setHidden] = useState<Set<Series>>(new Set());

  function toggle(s: Series) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {(Object.keys(SERIES_META) as Series[]).map((s) => {
          const isHidden = hidden.has(s);
          return (
            <button
              key={s}
              type="button"
              onClick={() => toggle(s)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium",
                isHidden ? "border-input bg-muted text-muted-foreground" : "border-input bg-background",
              )}
              aria-pressed={!isHidden}
            >
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: isHidden ? "hsl(215 16% 47%)" : SERIES_META[s].color }}
              />
              {SERIES_META[s].label}
            </button>
          );
        })}
      </div>
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 32% 91%)" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="hsl(215 16% 47%)" tickLine={false} axisLine={false} />
            <YAxis
              tick={{ fontSize: 10 }}
              stroke="hsl(215 16% 47%)"
              tickLine={false}
              axisLine={false}
              width={56}
              tickFormatter={(v) => `${(v / 1_000_000_000).toFixed(1)}M`}
            />
            <Tooltip
              contentStyle={{ borderRadius: 8, border: "1px solid hsl(214 32% 91%)", fontSize: 12 }}
              formatter={(v: number, name) => [formatCurrency(v), name]}
            />
            {(Object.keys(SERIES_META) as Series[]).map((s) =>
              hidden.has(s) ? null : (
                <Line
                  key={s}
                  type="monotone"
                  dataKey={s}
                  name={SERIES_META[s].label}
                  stroke={SERIES_META[s].color}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              ),
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
