"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatCurrency } from "@/lib/utils";

const COLORS: Record<string, string> = {
  "0-30": "hsl(142 71% 45%)",
  "31-60": "hsl(199 89% 48%)",
  "61-90": "hsl(38 92% 50%)",
  ">90": "hsl(0 84% 60%)",
};

export function AgingDonut({ data }: { data: { bucket: string; amount: number }[] }) {
  const total = data.reduce((s, d) => s + d.amount, 0);
  return (
    <div className="grid grid-cols-1 items-center gap-3 sm:grid-cols-[1fr,1fr]">
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip
              contentStyle={{
                borderRadius: 8,
                border: "1px solid hsl(214 32% 91%)",
                fontSize: 12,
                padding: "8px 10px",
              }}
              formatter={(v: number) => formatCurrency(v)}
            />
            <Pie data={data} dataKey="amount" nameKey="bucket" innerRadius={52} outerRadius={80} paddingAngle={2}>
              {data.map((d) => (
                <Cell key={d.bucket} fill={COLORS[d.bucket] ?? "hsl(215 16% 47%)"} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="space-y-2 text-sm">
        {data.map((d) => {
          const pct = total === 0 ? 0 : (d.amount / total) * 100;
          return (
            <div key={d.bucket} className="flex items-center gap-2">
              <span
                className="inline-block h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: COLORS[d.bucket] ?? "hsl(215 16% 47%)" }}
              />
              <span className="w-16 text-xs text-muted-foreground">{d.bucket}</span>
              <span className="flex-1 tabular-nums">{formatCurrency(d.amount)}</span>
              <span className="w-10 text-right text-xs text-muted-foreground tabular-nums">
                {pct.toFixed(0)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
