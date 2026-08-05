"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { SiteMarginPoint } from "@/lib/mock/site-detail";

export function MarginTrendChart({ data }: { data: SiteMarginPoint[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 32% 91%)" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(215 16% 47%)" tickLine={false} axisLine={false} />
          <YAxis
            tick={{ fontSize: 10 }}
            stroke="hsl(215 16% 47%)"
            tickLine={false}
            axisLine={false}
            width={40}
            domain={[30, 70]}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip
            contentStyle={{ borderRadius: 8, border: "1px solid hsl(214 32% 91%)", fontSize: 12 }}
            formatter={(v: number, name) =>
              name === "marginPct" ? [`${v.toFixed(1)}%`, "Margin"] : [`${v}%`, "Target"]
            }
          />
          <ReferenceLine
            y={50}
            stroke="hsl(215 16% 47%)"
            strokeDasharray="4 4"
            label={{ value: "Target 50%", position: "right", fill: "hsl(215 16% 47%)", fontSize: 10 }}
          />
          <Bar dataKey="marginPct" name="Margin %" fill="hsl(142 71% 45%)" radius={[4, 4, 0, 0]} />
          <Line type="monotone" dataKey="marginPct" stroke="hsl(142 71% 30%)" strokeWidth={2} dot={{ r: 3 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
