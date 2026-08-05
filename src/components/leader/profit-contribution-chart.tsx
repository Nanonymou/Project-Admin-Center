"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatCurrency } from "@/lib/utils";
import type { SiteKpi } from "@/lib/mock/site-kpi";

const PALETTE = [
  "hsl(221 83% 45%)",
  "hsl(199 89% 48%)",
  "hsl(142 71% 45%)",
  "hsl(38 92% 50%)",
  "hsl(0 84% 60%)",
  "hsl(272 68% 55%)",
  "hsl(178 70% 40%)",
];

export function ProfitContributionChart({ sites }: { sites: SiteKpi[] }) {
  const data = sites.map((s) => ({
    key: s.locationId,
    label: `${s.projectCode} · ${s.locationName}`,
    value: s.netMargin,
  }));
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Tooltip
            contentStyle={{ borderRadius: 8, border: "1px solid hsl(214 32% 91%)", fontSize: 12 }}
            formatter={(v: number, name) => [formatCurrency(v), name as string]}
          />
          <Pie data={data} dataKey="value" nameKey="label" innerRadius={54} outerRadius={92} paddingAngle={2}>
            {data.map((_, i) => (
              <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
