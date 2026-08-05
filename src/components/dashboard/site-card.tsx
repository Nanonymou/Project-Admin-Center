import Link from "next/link";
import { ArrowRight, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { SiteKpi } from "@/lib/mock/site-kpi";
import { cn, formatCurrency } from "@/lib/utils";
import { SiteSparkline } from "@/components/dashboard/site-sparkline";

const STATUS_MAP: Record<
  SiteKpi["closingStatus"],
  { label: string; variant: "success" | "warning" | "muted" }
> = {
  open: { label: "Open", variant: "muted" },
  closing: { label: "Closing Window", variant: "warning" },
  locked: { label: "Locked", variant: "success" },
};

export function SiteCard({ site }: { site: SiteKpi }) {
  const status = STATUS_MAP[site.closingStatus];
  const slaTone =
    site.slaPct >= 90
      ? "text-emerald-600"
      : site.slaPct >= 80
        ? "text-amber-600"
        : "text-rose-600";
  return (
    <Card className="flex flex-col">
      <CardContent className="flex flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {site.projectName}
            </div>
            <div className="mt-0.5 text-lg font-semibold leading-tight">{site.locationName}</div>
            <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
              <span>Invoice periode {site.invoicePeriod}</span>
              <span>·</span>
              <span>Cut-off {site.cutOffDaysLeft > 0 ? `H-${site.cutOffDaysLeft}` : "hari ini"}</span>
            </div>
          </div>
          <Badge variant={status.variant}>{status.label}</Badge>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <MiniStat label="Sales" value={formatCurrency(site.sales)} />
          <MiniStat label="Cost" value={formatCurrency(site.cost)} />
          <MiniStat
            label="Margin"
            value={`${site.marginPct.toFixed(1)}%`}
            hint={formatCurrency(site.netMargin)}
          />
        </div>

        <div className="h-14">
          <SiteSparkline data={site.trend7d} />
        </div>

        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-3">
            <span className={cn("font-medium tabular-nums", slaTone)}>SLA {site.slaPct}%</span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground tabular-nums">
              Pending {site.pendingApprovals}
            </span>
            <span className="text-muted-foreground">·</span>
            <span
              className={cn(
                "tabular-nums",
                site.overdueInvoices > 0 ? "font-medium text-rose-600" : "text-muted-foreground",
              )}
            >
              Overdue {site.overdueInvoices}
            </span>
          </div>
          <Link
            href={`/site/${site.locationId}`}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            Open Workspace
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function MiniStat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-md border bg-background p-2">
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 truncate text-sm font-semibold tabular-nums">{value}</div>
      {hint && (
        <div className="truncate text-[10px] text-muted-foreground tabular-nums">{hint}</div>
      )}
    </div>
  );
}

export function SiteCardEmpty() {
  return (
    <Card className="border-dashed">
      <CardContent className="flex h-[220px] flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
        <ExternalLink className="h-5 w-5" />
        Tidak ada site dalam scope Anda.
      </CardContent>
    </Card>
  );
}
