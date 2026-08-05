import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { ActivityKpi } from "@/lib/mock/activity";
import { cn } from "@/lib/utils";

const TONE_MAP: Record<ActivityKpi["tone"], { ring: string; dot: string }> = {
  primary: { ring: "ring-primary/20", dot: "bg-primary" },
  success: { ring: "ring-emerald-500/20", dot: "bg-emerald-500" },
  warning: { ring: "ring-amber-500/20", dot: "bg-amber-500" },
  danger: { ring: "ring-rose-500/20", dot: "bg-rose-500" },
  info: { ring: "ring-sky-500/20", dot: "bg-sky-500" },
};

export function KpiCard({ kpi }: { kpi: ActivityKpi }) {
  const tone = TONE_MAP[kpi.tone];
  const positive = kpi.delta >= 0;
  return (
    <Card className={cn("ring-1 ring-inset", tone.ring)}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {kpi.label}
          </span>
          <span className={cn("h-2 w-2 rounded-full", tone.dot)} />
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-2xl font-semibold tracking-tight">{kpi.value}</span>
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] font-medium",
              positive ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700",
            )}
          >
            {positive ? (
              <ArrowUpRight className="h-3 w-3" />
            ) : (
              <ArrowDownRight className="h-3 w-3" />
            )}
            {Math.abs(kpi.delta).toFixed(1)}%
          </span>
        </div>
        <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>{kpi.deltaLabel}</span>
          <span>{kpi.hint}</span>
        </div>
      </CardContent>
    </Card>
  );
}
