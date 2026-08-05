"use client";

import { useMemo, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { SiteCategoryPoint } from "@/lib/mock/site-detail";
import { cn, formatCurrency } from "@/lib/utils";

const PALETTE = [
  "hsl(221 83% 45%)",
  "hsl(199 89% 48%)",
  "hsl(142 71% 45%)",
  "hsl(38 92% 50%)",
  "hsl(0 84% 60%)",
  "hsl(272 68% 55%)",
  "hsl(178 70% 40%)",
];

export function CategoryDonut({ data }: { data: SiteCategoryPoint[] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const total = useMemo(() => data.reduce((s, d) => s + d.amount, 0), [data]);
  const active = activeIndex === null ? null : data[activeIndex];

  return (
    <div className="grid grid-cols-1 items-center gap-3 sm:grid-cols-[1fr,1.1fr]">
      <div className="relative h-56">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip
              contentStyle={{ borderRadius: 8, border: "1px solid hsl(214 32% 91%)", fontSize: 12 }}
              formatter={(v: number) => formatCurrency(v)}
            />
            <Pie
              data={data}
              dataKey="amount"
              nameKey="category"
              innerRadius={56}
              outerRadius={86}
              paddingAngle={2}
              onMouseEnter={(_, idx) => setActiveIndex(idx)}
              onMouseLeave={() => setActiveIndex(null)}
            >
              {data.map((_, i) => (
                <Cell
                  key={i}
                  fill={PALETTE[i % PALETTE.length]}
                  opacity={activeIndex === null || activeIndex === i ? 1 : 0.35}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {active ? active.category : "Total"}
          </div>
          <div className="text-sm font-semibold tabular-nums">
            {formatCurrency(active ? active.amount : total)}
          </div>
          {active && (
            <div className="text-[10px] text-muted-foreground tabular-nums">
              {((active.amount / total) * 100).toFixed(1)}%
            </div>
          )}
        </div>
      </div>
      <ul className="space-y-1.5 text-sm">
        {data.map((d, i) => {
          const pct = total === 0 ? 0 : (d.amount / total) * 100;
          const isActive = activeIndex === i;
          return (
            <li
              key={d.category}
              onMouseEnter={() => setActiveIndex(i)}
              onMouseLeave={() => setActiveIndex(null)}
              className={cn(
                "flex items-center gap-2 rounded px-1.5 py-1 text-xs",
                isActive ? "bg-accent" : "hover:bg-accent/60",
              )}
            >
              <span
                className="inline-block h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: PALETTE[i % PALETTE.length] }}
              />
              <span className="flex-1 truncate">{d.category}</span>
              <span className="tabular-nums text-muted-foreground">{formatCurrency(d.amount)}</span>
              <span className="w-10 text-right tabular-nums text-muted-foreground">
                {pct.toFixed(0)}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
