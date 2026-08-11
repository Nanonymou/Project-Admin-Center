"use client";

import { useMemo } from "react";
import type { SiteDaily } from "@/lib/mock/site-detail";
import { formatCurrencyCompact } from "@/lib/utils";

/**
 * Cost Trend — a lightweight daily cost visualization for the Analytics
 * Dashboard. Renders each day's total cost as a bar (sized against the peak) with
 * its cost‑to‑sales ratio, so cost movement and efficiency read at a glance
 * without pulling in a chart library. Pure/presentational; data is aggregated by
 * the page.
 */
export function CostTrendChart({ data }: { data: SiteDaily[] }) {
  const maxCost = useMemo(() => Math.max(1, ...data.map((d) => d.cost)), [data]);
  const avgRatio = useMemo(() => {
    const totalSales = data.reduce((s, d) => s + d.sales, 0);
    const totalCost = data.reduce((s, d) => s + d.cost, 0);
    return totalSales > 0 ? (totalCost / totalSales) * 100 : 0;
  }, [data]);

  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Tidak ada data.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Biaya harian (agregat)</span>
        <span>
          Rata-rata rasio biaya: <b className="text-foreground">{avgRatio.toFixed(1)}%</b>
        </span>
      </div>
      <div className="flex items-end gap-2" style={{ height: 180 }}>
        {data.map((d) => {
          const ratio = d.sales > 0 ? (d.cost / d.sales) * 100 : 0;
          const heightPct = (d.cost / maxCost) * 100;
          return (
            <div key={d.iso} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-[10px] text-muted-foreground">{ratio.toFixed(0)}%</span>
              <div className="flex w-full flex-1 items-end">
                <div
                  className="w-full rounded-t bg-amber-400/80 transition-all hover:bg-amber-500"
                  style={{ height: `${heightPct}%` }}
                  title={`${d.date}: ${formatCurrencyCompact(d.cost)} (rasio ${ratio.toFixed(1)}%)`}
                />
              </div>
              <span className="truncate text-[10px] text-muted-foreground">{d.date}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
