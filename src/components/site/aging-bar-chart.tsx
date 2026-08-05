"use client";

import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { SiteInvoiceAging } from "@/lib/mock/site-detail";
import { formatCurrency } from "@/lib/utils";

const COLORS: Record<SiteInvoiceAging["bucket"], string> = {
  "0-30": "hsl(142 71% 45%)",
  "31-60": "hsl(199 89% 48%)",
  "61-90": "hsl(38 92% 50%)",
  ">90": "hsl(0 84% 60%)",
};

export function AgingBarChart({ data }: { data: SiteInvoiceAging[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 16, right: 12, left: 8, bottom: 0 }} barCategoryGap={20}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 32% 91%)" vertical={false} />
          <XAxis dataKey="bucket" tick={{ fontSize: 11 }} stroke="hsl(215 16% 47%)" tickLine={false} axisLine={false} />
          <YAxis
            tick={{ fontSize: 10 }}
            stroke="hsl(215 16% 47%)"
            tickLine={false}
            axisLine={false}
            width={60}
            tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}jt`}
          />
          <Tooltip
            contentStyle={{ borderRadius: 8, border: "1px solid hsl(214 32% 91%)", fontSize: 12 }}
            formatter={(v: number, _n, item) => [
              formatCurrency(v),
              `Aging ${item.payload.bucket} · ${item.payload.count} invoice`,
            ]}
          />
          <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
            {data.map((d) => (
              <Cell key={d.bucket} fill={COLORS[d.bucket]} />
            ))}
            <LabelList
              dataKey="count"
              position="top"
              formatter={(v: unknown) => (typeof v === "number" && v > 0 ? `${v} inv` : "")}
              style={{ fontSize: 10, fill: "hsl(215 16% 47%)" }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
