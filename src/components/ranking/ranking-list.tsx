import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { SiteKpi } from "@/lib/mock/site-kpi";
import { cn, formatCurrency, formatNumber } from "@/lib/utils";

type Props = {
  sites: SiteKpi[];
  metricLabel: string;
  metricValue: (s: SiteKpi) => string;
  metricRaw: (s: SiteKpi) => number;
  deltaValue?: (s: SiteKpi) => number | null;
};

export function RankingList({ sites, metricLabel, metricValue, metricRaw, deltaValue }: Props) {
  const max = sites.reduce((m, s) => Math.max(m, metricRaw(s)), 0);
  return (
    <ol className="divide-y">
      {sites.map((site, i) => {
        const raw = metricRaw(site);
        const pct = max === 0 ? 0 : (raw / max) * 100;
        const delta = deltaValue?.(site) ?? null;
        const trend =
          delta === null
            ? "flat"
            : delta > 0.5
              ? "up"
              : delta < -0.5
                ? "down"
                : "flat";
        return (
          <li key={site.locationId} className="flex items-center gap-4 px-4 py-3">
            <div
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-sm font-semibold tabular-nums",
                i === 0 && "bg-amber-100 text-amber-900",
                i === 1 && "bg-slate-100 text-slate-800",
                i === 2 && "bg-orange-100 text-orange-900",
                i > 2 && "bg-muted text-muted-foreground",
              )}
            >
              {i + 1}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-medium">{site.locationName}</span>
                <span className="text-[11px] text-muted-foreground">· {site.projectCode}</span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <div className="h-1.5 w-full max-w-xs overflow-hidden rounded bg-muted">
                  <div
                    className={cn(
                      "h-full rounded",
                      i === 0
                        ? "bg-amber-500"
                        : i === 1
                          ? "bg-slate-400"
                          : i === 2
                            ? "bg-orange-500"
                            : "bg-primary/70",
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  {pct.toFixed(0)}% dari #1
                </span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[11px] text-muted-foreground">{metricLabel}</div>
              <div className="text-sm font-semibold tabular-nums">{metricValue(site)}</div>
            </div>
            {delta !== null && (
              <div
                className={cn(
                  "inline-flex w-16 items-center justify-end gap-0.5 text-xs font-medium tabular-nums",
                  trend === "up" && "text-emerald-700",
                  trend === "down" && "text-rose-700",
                  trend === "flat" && "text-muted-foreground",
                )}
              >
                {trend === "up" && <ArrowUpRight className="h-3 w-3" />}
                {trend === "down" && <ArrowDownRight className="h-3 w-3" />}
                {trend === "flat" && <Minus className="h-3 w-3" />}
                {Math.abs(delta).toFixed(1)}%
              </div>
            )}
            <Link
              href={`/site/${site.locationId}`}
              className="text-xs font-medium text-primary hover:underline"
            >
              Detail →
            </Link>
          </li>
        );
      })}
      {sites.length === 0 && (
        <li className="px-4 py-10 text-center text-sm text-muted-foreground">
          Tidak ada site untuk kriteria ini.
        </li>
      )}
    </ol>
  );
}
