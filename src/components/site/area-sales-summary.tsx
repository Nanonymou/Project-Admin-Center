"use client";

import { useMemo, useState } from "react";
import { MapPin } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buildAreaSales } from "@/lib/mock/area-sales";
import type { SiteKpi } from "@/lib/mock/site-kpi";
import { cn, formatCurrency } from "@/lib/utils";

export function AreaSalesSummary({ site }: { site: SiteKpi }) {
  const areaRows = useMemo(() => buildAreaSales(site), [site]);
  const [areaId, setAreaId] = useState<string>("all");

  const grandTotal = areaRows.reduce((s, a) => s + a.total, 0);

  const shownRows = areaId === "all" ? areaRows : areaRows.filter((a) => a.areaId === areaId);

  // Category totals for the selected scope.
  const categoryTotals = useMemo(() => {
    const map = new Map<string, { qty: number; amount: number }>();
    for (const row of shownRows) {
      for (const c of row.categories) {
        const cur = map.get(c.label) ?? { qty: 0, amount: 0 };
        cur.qty += c.qty;
        cur.amount += c.amount;
        map.set(c.label, cur);
      }
    }
    return Array.from(map.entries())
      .map(([label, v]) => ({ label, ...v }))
      .sort((a, b) => b.amount - a.amount);
  }, [shownRows]);

  const scopeTotal = shownRows.reduce((s, a) => s + a.total, 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            Ringkasan Penjualan per Area
          </CardTitle>
          <CardDescription>Total sales per kategori, dapat difilter per area.</CardDescription>
        </div>
        <select
          value={areaId}
          onChange={(e) => setAreaId(e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="all">Semua area</option>
          {areaRows.map((a) => (
            <option key={a.areaId} value={a.areaId}>
              {a.areaName}
            </option>
          ))}
        </select>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2 text-sm">
          <span className="text-muted-foreground">
            {areaId === "all" ? "Total semua area" : "Total area terpilih"}
          </span>
          <span className="font-semibold tabular-nums">
            {formatCurrency(scopeTotal)}
            {areaId !== "all" && grandTotal > 0 && (
              <span className="ml-2 text-[11px] font-normal text-muted-foreground">
                {((scopeTotal / grandTotal) * 100).toFixed(0)}% dari total site
              </span>
            )}
          </span>
        </div>

        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 text-left font-medium">Kategori</th>
                <th className="px-3 py-2 text-right font-medium">Qty</th>
                <th className="px-3 py-2 text-right font-medium">Sales</th>
                <th className="px-3 py-2 text-right font-medium">Share</th>
              </tr>
            </thead>
            <tbody>
              {categoryTotals.map((c) => {
                const pct = scopeTotal === 0 ? 0 : (c.amount / scopeTotal) * 100;
                return (
                  <tr key={c.label} className="border-b last:border-0">
                    <td className="px-3 py-2 font-medium">{c.label}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{c.qty}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(c.amount)}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded bg-muted">
                          <div className="h-full bg-primary/70" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="w-9 text-right text-[11px] tabular-nums text-muted-foreground">
                          {pct.toFixed(0)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {areaId === "all" && (
          <div className="flex flex-wrap gap-1.5">
            {areaRows.map((a) => (
              <button
                key={a.areaId}
                type="button"
                onClick={() => setAreaId(a.areaId)}
                className={cn(
                  "rounded-full border border-input bg-background px-2.5 py-1 text-[11px] font-medium hover:bg-accent",
                )}
              >
                {a.areaName.split(" — ")[1] ?? a.areaName}: {formatCurrency(a.total)}
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
