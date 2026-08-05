"use client";

import { useMemo } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useGlobalFilters } from "@/components/providers/global-filter-provider";
import { daysBetween } from "@/lib/mock/site-kpi";
import type { SiteDaily } from "@/lib/mock/site-detail";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

type Props = {
  daily30d: SiteDaily[];
};

type Aggregate = {
  sales: number;
  cost: number;
  profit: number;
  days: number;
};

function aggregate(rows: SiteDaily[]): Aggregate {
  return rows.reduce(
    (acc, r) => {
      acc.sales += r.sales;
      acc.cost += r.cost;
      acc.profit += r.sales - r.cost;
      return acc;
    },
    { sales: 0, cost: 0, profit: 0, days: rows.length },
  );
}

function withinRange(iso: string, from: string, to: string) {
  return iso >= from && iso <= to;
}

/**
 * Renders "this period vs. previous same-length window" for the site's
 * daily series, driven by the global period filter.
 */
export function SitePeriodComparison({ daily30d }: Props) {
  const { filters } = useGlobalFilters();

  const analytics = useMemo(() => {
    const days = daysBetween(filters.from, filters.to);
    const current = daily30d.filter((d) => withinRange(d.iso, filters.from, filters.to));

    const prevTo = new Date(filters.from);
    prevTo.setDate(prevTo.getDate() - 1);
    const prevFrom = new Date(prevTo);
    prevFrom.setDate(prevFrom.getDate() - Math.max(0, days - 1));
    const prevFromIso = prevFrom.toISOString().slice(0, 10);
    const prevToIso = prevTo.toISOString().slice(0, 10);

    const previous = daily30d.filter((d) => withinRange(d.iso, prevFromIso, prevToIso));

    return {
      days,
      current: aggregate(current),
      previous: aggregate(previous),
      prevFromIso,
      prevToIso,
    };
  }, [daily30d, filters.from, filters.to]);

  const items: {
    key: string;
    label: string;
    current: number;
    previous: number;
    format: (v: number) => string;
  }[] = [
    { key: "sales", label: "Sales", current: analytics.current.sales, previous: analytics.previous.sales, format: formatCurrency },
    { key: "cost", label: "Cost", current: analytics.current.cost, previous: analytics.previous.cost, format: formatCurrency },
    { key: "profit", label: "Profit", current: analytics.current.profit, previous: analytics.previous.profit, format: formatCurrency },
  ];

  const hasPrevious = analytics.previous.days > 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle>Periode Ini vs. Sebelumnya</CardTitle>
          <CardDescription>
            {analytics.days} hari · {formatDate(filters.from)} — {formatDate(filters.to)}
            {hasPrevious && (
              <>
                {" · "}
                sebelumnya {formatDate(analytics.prevFromIso)} — {formatDate(analytics.prevToIso)}
              </>
            )}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {items.map((item) => {
          const delta = item.previous === 0 ? 0 : ((item.current - item.previous) / item.previous) * 100;
          const trend = delta > 0.5 ? "up" : delta < -0.5 ? "down" : "flat";
          return (
            <div key={item.key} className="rounded-md border p-3">
              <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {item.label}
              </div>
              <div className="mt-1.5 text-lg font-semibold tabular-nums">
                {item.format(item.current)}
              </div>
              <div className="text-[11px] text-muted-foreground tabular-nums">
                Sebelumnya {item.format(item.previous)}
              </div>
              <div
                className={cn(
                  "mt-2 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold",
                  trend === "up" && "bg-emerald-50 text-emerald-700",
                  trend === "down" && "bg-rose-50 text-rose-700",
                  trend === "flat" && "bg-muted text-muted-foreground",
                )}
              >
                {trend === "up" && <ArrowUpRight className="h-3 w-3" />}
                {trend === "down" && <ArrowDownRight className="h-3 w-3" />}
                {trend === "flat" && <Minus className="h-3 w-3" />}
                {hasPrevious ? `${Math.abs(delta).toFixed(1)}%` : "n/a"}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
