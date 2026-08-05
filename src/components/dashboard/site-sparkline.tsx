"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatCurrency } from "@/lib/utils";

export function SiteSparkline({ data }: { data: { day: string; sales: number; cost: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <Tooltip
          contentStyle={{
            borderRadius: 8,
            border: "1px solid hsl(214 32% 91%)",
            fontSize: 11,
            padding: "6px 8px",
          }}
          formatter={(v: number, name) => [formatCurrency(v), name === "sales" ? "Sales" : "Cost"]}
        />
        <Line type="monotone" dataKey="sales" stroke="hsl(221 83% 45%)" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="cost" stroke="hsl(38 92% 50%)" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
