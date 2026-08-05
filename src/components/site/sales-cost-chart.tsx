"use client";

import { useMemo, useState } from "react";
import {
  Area,
  Brush,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from "recharts";
import { Eye, EyeOff, Focus } from "lucide-react";
import type { SiteDaily } from "@/lib/mock/site-detail";
import { useContainerSize } from "@/lib/hooks/use-container-size";
import { cn, formatCurrency } from "@/lib/utils";

type Series = "sales" | "cost" | "profit";
type ViewMode = "daily" | "cumulative";

const SERIES_META: Record<Series, { label: string; color: string }> = {
  sales: { label: "Sales", color: "hsl(221 83% 45%)" },
  cost: { label: "Cost", color: "hsl(38 92% 50%)" },
  profit: { label: "Profit", color: "hsl(142 71% 45%)" },
};

type Enriched = SiteDaily & {
  profit: number;
  salesCum: number;
  costCum: number;
  profitCum: number;
};

export function SalesCostChart({ data }: { data: SiteDaily[] }) {
  const [hidden, setHidden] = useState<Set<Series>>(new Set());
  const [focused, setFocused] = useState<Series | null>(null);
  const [mode, setMode] = useState<ViewMode>("daily");
  const { ref, width, isSmall } = useContainerSize<HTMLDivElement>();

  const enriched: Enriched[] = useMemo(() => {
    let sc = 0,
      cc = 0,
      pc = 0;
    return data.map((d) => {
      const profit = d.sales - d.cost;
      sc += d.sales;
      cc += d.cost;
      pc += profit;
      return { ...d, profit, salesCum: sc, costCum: cc, profitCum: pc };
    });
  }, [data]);

  function toggleHidden(s: Series) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  }

  function toggleFocus(s: Series) {
    setFocused((prev) => (prev === s ? null : s));
  }

  function opacityFor(s: Series) {
    if (hidden.has(s)) return 0;
    if (focused && focused !== s) return 0.25;
    return 1;
  }

  const salesKey = mode === "daily" ? "sales" : "salesCum";
  const costKey = mode === "daily" ? "cost" : "costCum";
  const profitKey = mode === "daily" ? "profit" : "profitCum";

  const total = enriched.at(-1);

  const tickInterval = tickIntervalFor(enriched.length, width);
  const yAxisWidth = isSmall ? 44 : 60;
  const fontSize = isSmall ? 9 : 10;

  return (
    <div ref={ref} className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {(Object.keys(SERIES_META) as Series[]).map((s) => {
            const meta = SERIES_META[s];
            const active = focused === s;
            const isHidden = hidden.has(s);
            return (
              <div
                key={s}
                className={cn(
                  "inline-flex items-center gap-1 rounded-md border pl-2 pr-1 text-xs font-medium transition-colors",
                  active
                    ? "border-primary bg-primary/5"
                    : isHidden
                      ? "border-input bg-muted text-muted-foreground"
                      : "border-input bg-background",
                )}
              >
                <button
                  type="button"
                  onClick={() => toggleHidden(s)}
                  className="inline-flex items-center gap-1.5 py-1"
                  aria-pressed={!isHidden}
                >
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: isHidden ? "hsl(215 16% 47%)" : meta.color }}
                  />
                  {meta.label}
                  {isHidden ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                </button>
                <button
                  type="button"
                  onClick={() => toggleFocus(s)}
                  disabled={isHidden}
                  className={cn(
                    "ml-0.5 flex h-6 w-6 items-center justify-center rounded",
                    active ? "bg-primary text-primary-foreground" : "hover:bg-accent",
                    isHidden && "cursor-not-allowed opacity-50",
                  )}
                  title="Focus mode: sorot seri ini"
                >
                  <Focus className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-muted-foreground">Tampilan:</span>
          {(["daily", "cumulative"] as ViewMode[]).map((m) => (
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
              {m === "daily" ? "Harian" : "Kumulatif"}
            </button>
          ))}
        </div>
      </div>

      <div className={cn("w-full", isSmall ? "h-56" : "h-72")}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={enriched} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
            <defs>
              <linearGradient id="salesArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={SERIES_META.sales.color} stopOpacity={0.3} />
                <stop offset="100%" stopColor={SERIES_META.sales.color} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="profitArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={SERIES_META.profit.color} stopOpacity={0.25} />
                <stop offset="100%" stopColor={SERIES_META.profit.color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 32% 91%)" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize }}
              stroke="hsl(215 16% 47%)"
              tickLine={false}
              axisLine={false}
              interval={tickInterval}
              minTickGap={isSmall ? 12 : 8}
            />
            <YAxis
              tick={{ fontSize }}
              stroke="hsl(215 16% 47%)"
              tickLine={false}
              axisLine={false}
              width={yAxisWidth}
              tickFormatter={compactCurrency}
            />
            <Tooltip
              content={(p) => <RichTooltip {...(p as RichTooltipProps)} mode={mode} />}
              cursor={{ stroke: "hsl(215 16% 47%)", strokeDasharray: "2 3" }}
            />
            <ReferenceLine y={0} stroke="hsl(215 16% 47%)" strokeDasharray="3 3" />
            <Legend wrapperStyle={{ display: "none" }} />
            {!hidden.has("sales") && (
              <Area
                type="monotone"
                dataKey={salesKey}
                name={SERIES_META.sales.label}
                stroke={SERIES_META.sales.color}
                strokeWidth={2}
                fill="url(#salesArea)"
                strokeOpacity={opacityFor("sales")}
                fillOpacity={opacityFor("sales")}
                dot={false}
                activeDot={{ r: 4 }}
              />
            )}
            {!hidden.has("profit") && (
              <Area
                type="monotone"
                dataKey={profitKey}
                name={SERIES_META.profit.label}
                stroke={SERIES_META.profit.color}
                strokeWidth={2}
                fill="url(#profitArea)"
                strokeOpacity={opacityFor("profit")}
                fillOpacity={opacityFor("profit")}
                dot={false}
                activeDot={{ r: 4 }}
              />
            )}
            {!hidden.has("cost") && (
              <Line
                type="monotone"
                dataKey={costKey}
                name={SERIES_META.cost.label}
                stroke={SERIES_META.cost.color}
                strokeWidth={2}
                strokeOpacity={opacityFor("cost")}
                dot={false}
                activeDot={{ r: 4 }}
              />
            )}
            <Brush
              dataKey="date"
              height={isSmall ? 18 : 22}
              travellerWidth={8}
              stroke="hsl(221 83% 45%)"
              fill="hsl(221 83% 95%)"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {total && (
        <div className="grid grid-cols-1 gap-3 rounded-md border bg-muted/30 p-3 text-xs sm:grid-cols-3">
          <MiniTotal label="Total Sales" value={formatCurrency(total.salesCum)} color={SERIES_META.sales.color} />
          <MiniTotal label="Total Cost" value={formatCurrency(total.costCum)} color={SERIES_META.cost.color} />
          <MiniTotal
            label="Total Profit"
            value={formatCurrency(total.profitCum)}
            color={SERIES_META.profit.color}
            hint={`${total.salesCum > 0 ? ((total.profitCum / total.salesCum) * 100).toFixed(1) : "0.0"}% margin`}
          />
        </div>
      )}
    </div>
  );
}

function MiniTotal({
  label,
  value,
  color,
  hint,
}: {
  label: string;
  value: string;
  color: string;
  hint?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="mt-0.5 inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="truncate text-sm font-semibold tabular-nums">{value}</div>
        {hint && <div className="text-[10px] text-muted-foreground">{hint}</div>}
      </div>
    </div>
  );
}

type RichTooltipProps = TooltipProps<number, string> & { mode: ViewMode };

function RichTooltip(props: RichTooltipProps) {
  const { active, payload, label, mode } = props;
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]?.payload as Enriched;
  const salesVal = mode === "daily" ? row.sales : row.salesCum;
  const costVal = mode === "daily" ? row.cost : row.costCum;
  const profitVal = mode === "daily" ? row.profit : row.profitCum;
  const marginPct = salesVal > 0 ? ((profitVal / salesVal) * 100).toFixed(1) : "0.0";
  return (
    <div className="rounded-lg border bg-card p-2.5 text-xs shadow-md">
      <div className="mb-1.5 flex items-center justify-between gap-4">
        <span className="font-semibold">{label}</span>
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {mode === "daily" ? "Harian" : "Kumulatif"}
        </span>
      </div>
      <TooltipRow color={SERIES_META.sales.color} label="Sales" value={salesVal} />
      <TooltipRow color={SERIES_META.cost.color} label="Cost" value={costVal} />
      <TooltipRow color={SERIES_META.profit.color} label="Profit" value={profitVal} />
      <div className="mt-1 border-t pt-1 text-[10px] text-muted-foreground">
        Margin: <b className="text-foreground">{marginPct}%</b>
      </div>
    </div>
  );
}

function TooltipRow({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <div className="flex items-center gap-2 py-0.5">
      <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      <span className="w-14 text-muted-foreground">{label}</span>
      <span className="tabular-nums font-medium">{formatCurrency(value)}</span>
    </div>
  );
}

function tickIntervalFor(pointCount: number, width: number): number | "preserveStartEnd" {
  if (pointCount === 0 || width === 0) return "preserveStartEnd";
  const maxLabels = Math.max(3, Math.floor(width / 60));
  if (pointCount <= maxLabels) return 0;
  return Math.floor(pointCount / maxLabels);
}

function compactCurrency(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}M`;
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(0)}jt`;
  if (abs >= 1_000) return `${(v / 1_000).toFixed(0)}rb`;
  return `${v}`;
}
