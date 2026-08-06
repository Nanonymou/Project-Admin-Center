"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn, formatCurrency } from "@/lib/utils";

export type SalesCompareItem = {
  key: string;
  label: string;
  sales: number;
  prevSales?: number;
};

const PALETTE = [
  "hsl(221 83% 45%)",
  "hsl(199 89% 48%)",
  "hsl(142 71% 45%)",
  "hsl(38 92% 50%)",
  "hsl(0 84% 60%)",
  "hsl(272 68% 55%)",
  "hsl(178 70% 40%)",
];

/**
 * Reusable sales comparison bar chart. Single mode colors each bar by
 * rank; comparison mode shows this-period vs previous-period grouped bars.
 */
export function SalesCompareBar({ data }: { data: SalesCompareItem[] }) {
  const [mode, setMode] = useState<"single" | "compare">("single");
  const hasPrev = useMemo(() => data.some((d) => d.prevSales !== undefined), [data]);
  const sorted = useMemo(() => [...data].sort((a, b) => b.sales - a.sales), [data]);

  if (data.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">
        Tidak ada data.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {hasPrev && (
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-muted-foreground">Mode:</span>
          {(["single", "compare"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                "rounded-md border px-2 py-1 text-xs font-medium",
                mode === m
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input bg-background hover:bg-accent",
              )}
            >
              {m === "single" ? "Periode ini" : "vs Periode lalu"}
            </button>
          ))}
        </div>
      )}
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={sorted} margin={{ top: 8, right: 12, left: 8, bottom: 0 }} barCategoryGap={mode === "compare" ? 12 : 16}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 32% 91%)" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="hsl(215 16% 47%)" tickLine={false} axisLine={false} />
            <YAxis
              tick={{ fontSize: 10 }}
              stroke="hsl(215 16% 47%)"
              tickLine={false}
              axisLine={false}
              width={64}
              tickFormatter={(v) => `${(v / 1_000_000_000).toFixed(1)}M`}
            />
            <Tooltip
              contentStyle={{ borderRadius: 8, border: "1px solid hsl(214 32% 91%)", fontSize: 12 }}
              formatter={(v: number, name) => [formatCurrency(v), name]}
            />
            {mode === "compare" && hasPrev ? (
              <>
                <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
                <Bar dataKey="prevSales" name="Periode lalu" fill="hsl(215 16% 70%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="sales" name="Periode ini" fill="hsl(221 83% 45%)" radius={[4, 4, 0, 0]} />
              </>
            ) : (
              <Bar dataKey="sales" name="Sales" radius={[4, 4, 0, 0]}>
                {sorted.map((_, i) => (
                  <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                ))}
              </Bar>
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
