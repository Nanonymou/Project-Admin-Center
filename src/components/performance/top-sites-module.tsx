"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Crown, ExternalLink, Medal, Trophy } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useActiveSite } from "@/components/providers/active-site-provider";
import type { SiteKpi } from "@/lib/mock/site-kpi";
import { cn, formatCurrency } from "@/lib/utils";

export type PerfMetric = "sales" | "netMargin" | "marginPct" | "slaPct";

const METRIC_META: Record<
  PerfMetric,
  { label: string; format: (s: SiteKpi) => string; raw: (s: SiteKpi) => number }
> = {
  sales: { label: "Sales", format: (s) => formatCurrency(s.sales), raw: (s) => s.sales },
  netMargin: { label: "Net Margin", format: (s) => formatCurrency(s.netMargin), raw: (s) => s.netMargin },
  marginPct: { label: "Margin %", format: (s) => `${s.marginPct.toFixed(1)}%`, raw: (s) => s.marginPct },
  slaPct: { label: "SLA", format: (s) => `${s.slaPct}%`, raw: (s) => s.slaPct },
};

const RANK_ICON = [Crown, Trophy, Medal] as const;
const RANK_BG = ["bg-amber-100 text-amber-900", "bg-slate-100 text-slate-800", "bg-orange-100 text-orange-900"];

/**
 * Reusable "Top N Site Performance" module. Ranks the provided sites by a
 * selectable metric and shows the top N with a relative bar.
 */
export function TopSitesModule({
  sites,
  topN = 5,
  defaultMetric = "netMargin",
  order = "desc",
  title = "Top 5 Site Performance",
  description = "Site dengan performa terbaik pada metrik terpilih.",
}: {
  sites: SiteKpi[];
  topN?: number;
  defaultMetric?: PerfMetric;
  order?: "desc" | "asc";
  title?: string;
  description?: string;
}) {
  const [metric, setMetric] = useState<PerfMetric>(defaultMetric);
  const cfg = METRIC_META[metric];
  const router = useRouter();
  const { setActiveLocationId } = useActiveSite();

  function openWorkspace(locationId: string) {
    setActiveLocationId(locationId);
    router.push(`/site/${locationId}`);
  }

  const ranked = useMemo(() => {
    const dir = order === "asc" ? 1 : -1;
    return [...sites].sort((a, b) => (cfg.raw(a) - cfg.raw(b)) * dir).slice(0, topN);
  }, [sites, cfg, topN, order]);

  // Bar scale relative to the strongest value across the full set.
  const max = sites.reduce((m, s) => Math.max(m, cfg.raw(s)), 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-500" />
            {title}
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {(Object.keys(METRIC_META) as PerfMetric[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMetric(m)}
              className={cn(
                "rounded-md border px-2 py-1 text-xs font-medium",
                metric === m
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input bg-background hover:bg-accent",
              )}
            >
              {METRIC_META[m].label}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {ranked.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            Tidak ada site dalam scope.
          </div>
        ) : (
          <ol className="divide-y">
            {ranked.map((site, i) => {
              const Icon = RANK_ICON[i];
              const pct = max === 0 ? 0 : (cfg.raw(site) / max) * 100;
              return (
                <li
                  key={site.locationId}
                  onClick={() => openWorkspace(site.locationId)}
                  className="flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/50"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") openWorkspace(site.locationId);
                  }}
                >
                  <div
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-sm font-semibold tabular-nums",
                      i < 3 ? RANK_BG[i] : "bg-muted text-muted-foreground",
                    )}
                  >
                    {Icon ? <Icon className="h-4 w-4" /> : i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-medium">{site.locationName}</span>
                      <span className="text-[11px] text-muted-foreground">· {site.projectCode}</span>
                    </div>
                    <div className="mt-1 h-1.5 w-full max-w-xs overflow-hidden rounded bg-muted">
                      <div
                        className={cn(
                          "h-full rounded",
                          i === 0 ? "bg-amber-500" : i === 1 ? "bg-slate-400" : i === 2 ? "bg-orange-500" : "bg-primary/70",
                        )}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold tabular-nums">{cfg.format(site)}</div>
                    <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-primary">
                      <ExternalLink className="h-3 w-3" />
                      Open Workspace
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
