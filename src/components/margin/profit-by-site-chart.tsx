"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MarginBySite } from "@/lib/mock/margin-data";
import { cn, formatCurrency } from "@/lib/utils";

type SortKey = "profit" | "marginPct" | "sales";
type Mode = "profit" | "salesVsCost";

const SORT_LABEL: Record<SortKey, string> = {
  profit: "Profit",
  marginPct: "Margin %",
  sales: "Sales",
};

function marginColor(marginPct: number) {
  return marginPct >= 55
    ? "hsl(142 71% 45%)"
    : marginPct >= 45
      ? "hsl(38 92% 50%)"
      : "hsl(0 84% 60%)";
}

/**
 * Reusable per-site profit comparison chart with sort + mode toggles.
 */
export function ProfitBySiteChart({ data }: { data: MarginBySite[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("profit");
  const [mode, setMode] = useState<Mode>("profit");

  const rows = useMemo(() => {
    const list = data.map((d) => ({ ...d, cost: d.sales - d.profit }));
    list.sort((a, b) => (b[sortKey] as number) - (a[sortKey] as number));
    return list;
  }, [data, sortKey]);

  if (data.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">
        Tidak ada data.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-muted-foreground">Mode:</span>
          {(["profit", "salesVsCost"] as Mode[]).map((m) => (
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
              {m === "profit" ? "Profit" : "Sales vs Cost"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-muted-foreground">Urut:</span>
          {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setSortKey(k)}
              className={cn(
                "rounded-md border px-2 py-1 text-xs font-medium",
                sortKey === k
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input bg-background hover:bg-accent",
              )}
            >
              {SORT_LABEL[k]}
            </button>
          ))}
        </div>
      </div>

      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 16, right: 12, left: 8, bottom: 0 }} barCategoryGap={mode === "profit" ? 16 : 10}>
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
            {mode === "profit" ? (
              <Bar dataKey="profit" name="Profit" radius={[4, 4, 0, 0]}>
                {rows.map((r) => (
                  <Cell key={r.locationId} fill={marginColor(r.marginPct)} />
                ))}
                <LabelList
                  dataKey="marginPct"
                  position="top"
                  formatter={(v: unknown) => (typeof v === "number" ? `${v.toFixed(0)}%` : "")}
                  style={{ fontSize: 10, fill: "hsl(215 16% 47%)" }}
                />
              </Bar>
            ) : (
              <>
                <Bar dataKey="sales" name="Sales" fill="hsl(221 83% 45%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="cost" name="Cost" fill="hsl(38 92% 50%)" radius={[4, 4, 0, 0]} />
              </>
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
        {mode === "profit" ? (
          <>
            <LegendItem color="hsl(142 71% 45%)" label="Margin ≥ 55%" />
            <LegendItem color="hsl(38 92% 50%)" label="Margin 45–55%" />
            <LegendItem color="hsl(0 84% 60%)" label="Margin < 45%" />
          </>
        ) : (
          <>
            <LegendItem color="hsl(221 83% 45%)" label="Sales" />
            <LegendItem color="hsl(38 92% 50%)" label="Cost" />
          </>
        )}
      </div>
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}
