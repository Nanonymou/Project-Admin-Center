import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ComparisonStat } from "@/lib/mock/activity";
import { cn, formatCurrency, formatNumber } from "@/lib/utils";

function formatValue(value: number, unit: ComparisonStat["unit"]) {
  if (unit === "idr") return formatCurrency(value);
  if (unit === "pct") return `${value.toFixed(1)}%`;
  return formatNumber(value);
}

function deltaPct(today: number, yesterday: number) {
  if (yesterday === 0) return today === 0 ? 0 : 100;
  return ((today - yesterday) / yesterday) * 100;
}

export function ComparisonPanel({
  stats,
  title = "Perbandingan Hari Ini vs Kemarin",
  description = "Snapshot metrik utama dibandingkan dengan periode sebelumnya.",
}: {
  stats: ComparisonStat[];
  title?: string;
  description?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-primary" /> Hari Ini
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-muted-foreground/60" /> Kemarin
          </span>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="grid grid-cols-2 divide-x divide-y border-t sm:grid-cols-3 lg:grid-cols-5">
          {stats.map((stat) => {
            const delta = deltaPct(stat.today, stat.yesterday);
            const positive = delta > 0.05;
            const negative = delta < -0.05;
            const trendPct = Math.abs(delta);
            return (
              <div key={stat.key} className="p-4">
                <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {stat.label}
                </div>
                <div className="mt-2 text-lg font-semibold tabular-nums">
                  {formatValue(stat.today, stat.unit)}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                  Kemarin: {formatValue(stat.yesterday, stat.unit)}
                </div>
                <div
                  className={cn(
                    "mt-2 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold",
                    positive && "bg-emerald-50 text-emerald-700",
                    negative && "bg-rose-50 text-rose-700",
                    !positive && !negative && "bg-muted text-muted-foreground",
                  )}
                >
                  {positive && <ArrowUpRight className="h-3 w-3" />}
                  {negative && <ArrowDownRight className="h-3 w-3" />}
                  {!positive && !negative && <Minus className="h-3 w-3" />}
                  {trendPct.toFixed(1)}%
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
