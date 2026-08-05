"use client";

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency } from "@/lib/utils";

export type ProfitTrendPoint = {
  month: string;
  sales: number;
  cost: number;
  profit: number;
  marginPct: number;
};

export function ProfitTrendChart({ data }: { data: ProfitTrendPoint[] }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
          <defs>
            <linearGradient id="profitFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(142 71% 45%)" stopOpacity={0.3} />
              <stop offset="100%" stopColor="hsl(142 71% 45%)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 32% 91%)" vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="hsl(215 16% 47%)" tickLine={false} axisLine={false} />
          <YAxis
            yAxisId="left"
            tick={{ fontSize: 10 }}
            stroke="hsl(215 16% 47%)"
            tickLine={false}
            axisLine={false}
            width={56}
            tickFormatter={(v) => `${(v / 1_000_000_000).toFixed(1)}M`}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 10 }}
            stroke="hsl(215 16% 47%)"
            tickLine={false}
            axisLine={false}
            width={40}
            domain={[0, 80]}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip
            contentStyle={{ borderRadius: 8, border: "1px solid hsl(214 32% 91%)", fontSize: 12 }}
            formatter={(v: number, name) =>
              name === "marginPct" ? [`${v.toFixed(1)}%`, "Margin %"] : [formatCurrency(v), name]
            }
          />
          <Area
            yAxisId="left"
            type="monotone"
            dataKey="profit"
            name="Profit"
            stroke="hsl(142 71% 45%)"
            strokeWidth={2}
            fill="url(#profitFill)"
          />
          <Line yAxisId="left" type="monotone" dataKey="sales" name="Sales" stroke="hsl(221 83% 45%)" strokeWidth={2} dot={false} />
          <Line yAxisId="left" type="monotone" dataKey="cost" name="Cost" stroke="hsl(38 92% 50%)" strokeWidth={2} dot={false} />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="marginPct"
            name="Margin %"
            stroke="hsl(272 68% 55%)"
            strokeWidth={2}
            strokeDasharray="4 3"
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
