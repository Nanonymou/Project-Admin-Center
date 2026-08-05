"use client";

import { useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { SiteDaily } from "@/lib/mock/site-detail";
import { formatCurrency } from "@/lib/utils";

type Series = "sales" | "cost" | "margin";

export function SalesCostChart({ data }: { data: SiteDaily[] }) {
  const [hidden, setHidden] = useState<Set<Series>>(new Set());
  const withMargin = data.map((d) => ({ ...d, margin: d.sales - d.cost }));

  function toggle(s: Series) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={withMargin} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
          <defs>
            <linearGradient id="salesArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(221 83% 45%)" stopOpacity={0.3} />
              <stop offset="100%" stopColor="hsl(221 83% 45%)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 32% 91%)" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(215 16% 47%)" tickLine={false} axisLine={false} />
          <YAxis
            tick={{ fontSize: 10 }}
            stroke="hsl(215 16% 47%)"
            tickLine={false}
            axisLine={false}
            width={60}
            tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}jt`}
          />
          <Tooltip
            contentStyle={{ borderRadius: 8, border: "1px solid hsl(214 32% 91%)", fontSize: 12 }}
            formatter={(v: number) => formatCurrency(v)}
          />
          <Legend
            wrapperStyle={{ fontSize: 11, cursor: "pointer" }}
            iconType="circle"
            onClick={(entry) => toggle(entry.dataKey as Series)}
          />
          <Area
            hide={hidden.has("sales")}
            type="monotone"
            dataKey="sales"
            name="Sales"
            stroke="hsl(221 83% 45%)"
            strokeWidth={2}
            fill="url(#salesArea)"
          />
          <Line
            hide={hidden.has("cost")}
            type="monotone"
            dataKey="cost"
            name="Cost"
            stroke="hsl(38 92% 50%)"
            strokeWidth={2}
            dot={false}
          />
          <Line
            hide={hidden.has("margin")}
            type="monotone"
            dataKey="margin"
            name="Margin"
            stroke="hsl(142 71% 45%)"
            strokeWidth={2}
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
