import Link from "next/link";
import { Crown, Medal, Trophy } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { SiteKpi } from "@/lib/mock/site-kpi";
import { cn, formatCurrency } from "@/lib/utils";

const ORNAMENTS = [
  {
    icon: Crown,
    label: "Juara 1",
    accent: "from-amber-400 to-amber-200",
    badge: "bg-amber-500 text-amber-950",
    height: "h-40",
  },
  {
    icon: Trophy,
    label: "Juara 2",
    accent: "from-slate-300 to-slate-100",
    badge: "bg-slate-400 text-slate-950",
    height: "h-32",
  },
  {
    icon: Medal,
    label: "Juara 3",
    accent: "from-orange-400 to-orange-200",
    badge: "bg-orange-500 text-orange-950",
    height: "h-28",
  },
] as const;

export function RankingPodium({
  sites,
  metricLabel,
  metricValue,
}: {
  sites: SiteKpi[];
  metricLabel: string;
  metricValue: (s: SiteKpi) => string;
}) {
  if (sites.length === 0) return null;
  // Rearrange for classic podium visual: [2nd, 1st, 3rd]
  const podium = [sites[1], sites[0], sites[2]].filter(Boolean);
  const order = [1, 0, 2];

  return (
    <div className="grid grid-cols-3 gap-3 sm:gap-4">
      {podium.map((site, i) => {
        const rank = order[i];
        const orn = ORNAMENTS[rank];
        const Icon = orn.icon;
        return (
          <Card key={site.locationId} className="overflow-hidden">
            <div className={cn("flex items-end justify-center bg-gradient-to-b p-3 text-center", orn.accent, orn.height)}>
              <div className="text-white drop-shadow-sm">
                <Icon className="mx-auto h-7 w-7" />
                <div className="mt-1 text-[11px] font-semibold uppercase tracking-wide">{orn.label}</div>
              </div>
            </div>
            <CardContent className="space-y-2 p-4 text-center">
              <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {site.projectCode}
              </div>
              <div className="text-base font-semibold leading-tight">{site.locationName}</div>
              <div className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold", orn.badge)}>
                #{rank + 1}
              </div>
              <div>
                <div className="text-[11px] text-muted-foreground">{metricLabel}</div>
                <div className="text-lg font-semibold tabular-nums">{metricValue(site)}</div>
              </div>
              <div className="pt-1">
                <Link
                  href={`/site/${site.locationId}`}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Buka Site →
                </Link>
              </div>
            </CardContent>
          </Card>
        );
      })}
      {formatPodiumFallback(sites.length)}
    </div>
  );
}

function formatPodiumFallback(count: number) {
  if (count >= 3) return null;
  return Array.from({ length: 3 - count }, (_, i) => (
    <Card key={`empty-${i}`} className="border-dashed">
      <CardContent className="flex h-full items-center justify-center py-10 text-center text-xs text-muted-foreground">
        —
      </CardContent>
    </Card>
  ));
}
