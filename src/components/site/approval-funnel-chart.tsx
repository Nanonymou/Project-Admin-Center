"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { SiteApprovalStage } from "@/lib/mock/site-detail";

export function ApprovalFunnelChart({ data }: { data: SiteApprovalStage[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 8, right: 12, left: 8, bottom: 0 }}
          barCategoryGap={14}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 32% 91%)" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 10 }} stroke="hsl(215 16% 47%)" tickLine={false} axisLine={false} />
          <YAxis
            type="category"
            dataKey="stage"
            tick={{ fontSize: 11 }}
            stroke="hsl(215 16% 47%)"
            tickLine={false}
            axisLine={false}
            width={120}
          />
          <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(214 32% 91%)", fontSize: 12 }} />
          <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
          <Bar dataKey="onTime" stackId="a" fill="hsl(142 71% 45%)" name="On Time" radius={[0, 0, 0, 0]} />
          <Bar dataKey="atRisk" stackId="a" fill="hsl(38 92% 50%)" name="At Risk" radius={[0, 0, 0, 0]} />
          <Bar dataKey="overdue" stackId="a" fill="hsl(0 84% 60%)" name="Overdue" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
