"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { SlaStageBar } from "@/lib/mock/activity";

export function SlaStageChart({ data }: { data: SlaStageBar[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }} barCategoryGap={16}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 32% 91%)" vertical={false} />
          <XAxis dataKey="stage" tick={{ fontSize: 11 }} stroke="hsl(215 16% 47%)" tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 11 }} stroke="hsl(215 16% 47%)" tickLine={false} axisLine={false} width={40} />
          <Tooltip
            contentStyle={{
              borderRadius: 8,
              border: "1px solid hsl(214 32% 91%)",
              fontSize: 12,
              padding: "8px 10px",
            }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
          <Bar dataKey="onTime" stackId="a" fill="hsl(142 71% 45%)" name="On Time" radius={[0, 0, 0, 0]} />
          <Bar dataKey="atRisk" stackId="a" fill="hsl(38 92% 50%)" name="At Risk" radius={[0, 0, 0, 0]} />
          <Bar dataKey="overdue" stackId="a" fill="hsl(0 84% 60%)" name="Overdue" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
