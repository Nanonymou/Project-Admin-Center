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
import type { HourlyPoint } from "@/lib/mock/activity";

export function HourlyTrendChart({
  data,
  showComparison = false,
}: {
  data: HourlyPoint[];
  showComparison?: boolean;
}) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
          <defs>
            <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(221 83% 45%)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="hsl(221 83% 45%)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="costFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(38 92% 50%)" stopOpacity={0.3} />
              <stop offset="100%" stopColor="hsl(38 92% 50%)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 32% 91%)" vertical={false} />
          <XAxis dataKey="hour" tick={{ fontSize: 11 }} stroke="hsl(215 16% 47%)" tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 11 }} stroke="hsl(215 16% 47%)" tickLine={false} axisLine={false} width={40} />
          <Tooltip
            contentStyle={{
              borderRadius: 8,
              border: "1px solid hsl(214 32% 91%)",
              fontSize: 12,
              padding: "8px 10px",
            }}
            labelStyle={{ fontWeight: 600, marginBottom: 4 }}
          />
          <Area type="monotone" dataKey="sales" stroke="hsl(221 83% 45%)" strokeWidth={2} fill="url(#salesFill)" name="Sales (Hari ini)" />
          <Area type="monotone" dataKey="cost" stroke="hsl(38 92% 50%)" strokeWidth={2} fill="url(#costFill)" name="Cost (Hari ini)" />
          {showComparison && (
            <>
              <Line
                type="monotone"
                dataKey="salesPrev"
                stroke="hsl(221 83% 45%)"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                dot={false}
                name="Sales (Kemarin)"
              />
              <Line
                type="monotone"
                dataKey="costPrev"
                stroke="hsl(38 92% 50%)"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                dot={false}
                name="Cost (Kemarin)"
              />
            </>
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
