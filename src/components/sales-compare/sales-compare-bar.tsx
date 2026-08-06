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
  type TooltipProps,
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
  const grandTotal = useMemo(() => sorted.reduce((s, d) => s + d.sales, 0), [sorted]);
  const rankMap = useMemo(() => {
    const m = new Map<string, number>();
    sorted.forEach((d, i) => m.set(d.label, i + 1));
    return m;
  }, [sorted]);

  function renderTooltip(props: TooltipProps<number, string>) {
    if (!props.active || !props.payload || props.payload.length === 0) return null;
    const row = props.payload[0]?.payload as SalesCompareItem;
    const share = grandTotal === 0 ? 0 : (row.sales / grandTotal) * 100;
    const delta =
      row.prevSales && row.prevSales !== 0 ? ((row.sales - row.prevSales) / row.prevSales) * 100 : undefined;
    return (
      <div className="rounded-lg border bg-card p-2.5 text-xs shadow-md">
        <div className="mb-1 flex items-center justify-between gap-4">
          <span className="font-semibold">{row.label}</span>
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold">#{rankMap.get(row.label)}</span>
        </div>
        <div className="flex items-center gap-2 py-0.5">
          <span className="inline-block h-2 w-2 rounded-full bg-primary" />
          <span className="w-20 text-muted-foreground">Periode ini</span>
          <span className="tabular-nums font-medium">{formatCurrency(row.sales)}</span>
        </div>
        {row.prevSales !== undefined && (
          <div className="flex items-center gap-2 py-0.5">
            <span className="inline-block h-2 w-2 rounded-full bg-muted-foreground/60" />
            <span className="w-20 text-muted-foreground">Periode lalu</span>
            <span className="tabular-nums font-medium">{formatCurrency(row.prevSales)}</span>
          </div>
        )}
        <div className="mt-1 border-t pt-1 text-[10px] text-muted-foreground">
          Share {share.toFixed(1)}%
          {delta !== undefined && (
            <span className={cn("ml-2 font-medium", delta >= 0 ? "text-emerald-600" : "text-rose-600")}>
              {delta >= 0 ? "+" : ""}
              {delta.toFixed(1)}% vs lalu
            </span>
          )}
        </div>
      </div>
    );
  }

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
            <Tooltip content={renderTooltip} cursor={{ fill: "hsl(214 32% 91% / 0.4)" }} />
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
      {mode === "single" && (
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
          <span className="font-medium">Legenda peringkat:</span>
          {sorted.slice(0, Math.min(5, sorted.length)).map((d, i) => (
            <span key={d.key} className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: PALETTE[i % PALETTE.length] }} />
              #{i + 1} {d.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
