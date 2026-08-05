"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { SiteKpi } from "@/lib/mock/site-kpi";
import { formatCurrency } from "@/lib/utils";

export function SiteComparisonChart({ sites }: { sites: SiteKpi[] }) {
  const data = sites.map((s) => ({
    site: `${s.projectCode} · ${s.locationName}`,
    Sales: s.sales,
    Cost: s.cost,
    Margin: s.netMargin,
  }));

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 12, left: 8, bottom: 0 }} barCategoryGap={14}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 32% 91%)" vertical={false} />
          <XAxis dataKey="site" tick={{ fontSize: 10 }} stroke="hsl(215 16% 47%)" tickLine={false} axisLine={false} />
          <YAxis
            tick={{ fontSize: 10 }}
            stroke="hsl(215 16% 47%)"
            tickLine={false}
            axisLine={false}
            width={80}
            tickFormatter={(v) => `${(v / 1_000_000_000).toFixed(1)}B`}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 8,
              border: "1px solid hsl(214 32% 91%)",
              fontSize: 12,
              padding: "8px 10px",
            }}
            formatter={(v: number) => formatCurrency(v)}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
          <Bar dataKey="Sales" fill="hsl(221 83% 45%)" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Cost" fill="hsl(38 92% 50%)" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Margin" fill="hsl(142 71% 45%)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
