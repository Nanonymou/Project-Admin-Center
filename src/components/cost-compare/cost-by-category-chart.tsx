"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getCostCategories } from "@/lib/mock/cost-config";
import type { SiteKpi } from "@/lib/mock/site-kpi";
import { formatCurrency } from "@/lib/utils";

const PALETTE = [
  "hsl(38 92% 50%)",
  "hsl(0 84% 60%)",
  "hsl(221 83% 45%)",
  "hsl(199 89% 48%)",
  "hsl(272 68% 55%)",
  "hsl(178 70% 40%)",
];

function seedOf(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffffffff;
  return Math.abs(h);
}
function rand(n: number) {
  const x = Math.sin(n) * 10000;
  return x - Math.floor(x);
}

/**
 * Stacked cost-by-category comparison across sites. Each site's total cost
 * is split across its project's cost categories (config-driven).
 */
export function CostByCategoryChart({ sites }: { sites: SiteKpi[] }) {
  const { data, categoryLabels } = useMemo(() => {
    const labelSet = new Set<string>();
    const rows = sites.map((site) => {
      const cats = getCostCategories(site.projectCode);
      const seed = seedOf(site.locationId);
      const weights = cats.map((_, i) => 1 + rand(seed + i) * 3);
      const wSum = weights.reduce((a, b) => a + b, 0);
      const row: Record<string, number | string> = {
        label: `${site.projectCode} · ${site.locationName}`,
      };
      cats.forEach((c, i) => {
        labelSet.add(c.label);
        row[c.label] = Math.round((weights[i] / wSum) * site.cost);
      });
      return row;
    });
    return { data: rows, categoryLabels: Array.from(labelSet) };
  }, [sites]);

  if (sites.length === 0) {
    return (
      <div className="flex h-80 items-center justify-center text-sm text-muted-foreground">
        Tidak ada data.
      </div>
    );
  }

  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 12, left: 8, bottom: 0 }} barCategoryGap={16}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 32% 91%)" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="hsl(215 16% 47%)" tickLine={false} axisLine={false} />
          <YAxis
            tick={{ fontSize: 10 }}
            stroke="hsl(215 16% 47%)"
            tickLine={false}
            axisLine={false}
            width={64}
            tickFormatter={(v) => `${(v / 1_000_000_000).toFixed(1)}M`}
          />
          <Tooltip
            contentStyle={{ borderRadius: 8, border: "1px solid hsl(214 32% 91%)", fontSize: 12 }}
            formatter={(v: number, name) => [formatCurrency(v), name]}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
          {categoryLabels.map((label, i) => (
            <Bar
              key={label}
              dataKey={label}
              stackId="cost"
              fill={PALETTE[i % PALETTE.length]}
              radius={i === categoryLabels.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
