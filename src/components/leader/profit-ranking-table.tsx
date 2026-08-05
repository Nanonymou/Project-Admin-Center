"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown, Crown, Medal, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { SiteKpi } from "@/lib/mock/site-kpi";
import { cn, formatCurrency, formatNumber } from "@/lib/utils";

type SortKey = "netMargin" | "marginPct" | "sales" | "cost" | "contribution";
type SortDir = "desc" | "asc";

const COLUMNS: {
  key: SortKey | "site";
  label: string;
  align: "left" | "right";
  sortable: boolean;
}[] = [
  { key: "site", label: "Site", align: "left", sortable: false },
  { key: "sales", label: "Sales", align: "right", sortable: true },
  { key: "cost", label: "Cost", align: "right", sortable: true },
  { key: "netMargin", label: "Net Profit", align: "right", sortable: true },
  { key: "marginPct", label: "Margin %", align: "right", sortable: true },
  { key: "contribution", label: "Kontribusi", align: "right", sortable: true },
];

const MEDAL: Record<number, { icon: React.ComponentType<{ className?: string }>; ring: string }> = {
  0: { icon: Crown, ring: "bg-amber-100 text-amber-900" },
  1: { icon: Trophy, ring: "bg-slate-100 text-slate-900" },
  2: { icon: Medal, ring: "bg-orange-100 text-orange-900" },
};

export function ProfitRankingTable({ sites }: { sites: SiteKpi[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("netMargin");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const totalProfit = useMemo(
    () => sites.reduce((s, x) => s + x.netMargin, 0),
    [sites],
  );

  const rows = useMemo(() => {
    const enriched = sites.map((s) => ({
      ...s,
      contribution: totalProfit === 0 ? 0 : (s.netMargin / totalProfit) * 100,
    }));
    const dir = sortDir === "desc" ? -1 : 1;
    enriched.sort((a, b) => {
      const av = (a as unknown as Record<string, number>)[sortKey];
      const bv = (b as unknown as Record<string, number>)[sortKey];
      return (av - bv) * dir;
    });
    return enriched;
  }, [sites, sortKey, sortDir, totalProfit]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
            <th className="w-14 px-3 py-2 text-center font-medium">#</th>
            {COLUMNS.map((col) => {
              const active = col.sortable && (col.key as SortKey) === sortKey;
              const alignClass = col.align === "right" ? "text-right" : "text-left";
              return (
                <th
                  key={col.key}
                  className={cn(
                    "px-3 py-2 font-medium",
                    alignClass,
                    col.sortable ? "cursor-pointer select-none hover:text-foreground" : "",
                  )}
                  onClick={() => col.sortable && toggleSort(col.key as SortKey)}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {col.sortable &&
                      (active ? (
                        sortDir === "desc" ? (
                          <ArrowDown className="h-3 w-3" />
                        ) : (
                          <ArrowUp className="h-3 w-3" />
                        )
                      ) : (
                        <ArrowUpDown className="h-3 w-3 opacity-40" />
                      ))}
                  </span>
                </th>
              );
            })}
            <th className="w-24 px-3 py-2 text-right font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={COLUMNS.length + 2} className="px-4 py-8 text-center text-sm text-muted-foreground">
                Tidak ada site dalam scope aktif.
              </td>
            </tr>
          )}
          {rows.map((row, i) => {
            const medal = MEDAL[i];
            const MedalIcon = medal?.icon;
            const marginTone =
              row.marginPct >= 55
                ? "success"
                : row.marginPct >= 45
                  ? "warning"
                  : "danger";
            return (
              <tr key={row.locationId} className="border-b last:border-0 hover:bg-muted/30">
                <td className="px-3 py-2 text-center">
                  <div className="inline-flex items-center gap-1">
                    <span
                      className={cn(
                        "flex h-6 w-6 items-center justify-center rounded-md text-xs font-semibold tabular-nums",
                        medal ? medal.ring : "bg-muted text-muted-foreground",
                      )}
                    >
                      {i + 1}
                    </span>
                    {MedalIcon && <MedalIcon className="h-3.5 w-3.5 text-muted-foreground" />}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <div className="text-sm font-medium">{row.locationName}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {row.projectCode} · periode {row.invoicePeriod}
                  </div>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(row.sales)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                  {formatCurrency(row.cost)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums font-semibold">
                  {formatCurrency(row.netMargin)}
                </td>
                <td className="px-3 py-2 text-right">
                  <Badge variant={marginTone} className="tabular-nums">
                    {row.marginPct.toFixed(1)}%
                  </Badge>
                </td>
                <td className="px-3 py-2">
                  <ContributionBar pct={row.contribution} />
                </td>
                <td className="px-3 py-2 text-right">
                  <Link
                    href={`/site/${row.locationId}`}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    Detail →
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
        {rows.length > 0 && (
          <tfoot>
            <tr className="border-t bg-muted/30 text-sm font-medium">
              <td colSpan={2} className="px-3 py-2">
                Total ({formatNumber(rows.length)} site)
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {formatCurrency(rows.reduce((s, r) => s + r.sales, 0))}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                {formatCurrency(rows.reduce((s, r) => s + r.cost, 0))}
              </td>
              <td className="px-3 py-2 text-right tabular-nums font-semibold">
                {formatCurrency(totalProfit)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {rows.length === 0
                  ? "—"
                  : `${(rows.reduce((s, r) => s + r.marginPct, 0) / rows.length).toFixed(1)}%`}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">100%</td>
              <td />
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

function ContributionBar({ pct }: { pct: number }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 overflow-hidden rounded bg-muted">
        <div
          className={
            clamped >= 25
              ? "h-full bg-emerald-500"
              : clamped >= 10
                ? "h-full bg-sky-500"
                : "h-full bg-amber-500"
          }
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span className="text-xs tabular-nums">{clamped.toFixed(1)}%</span>
    </div>
  );
}
