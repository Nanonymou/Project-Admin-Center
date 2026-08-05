import { AlertTriangle, Clock3, Landmark, Layers, PiggyBank, ShieldCheck, Wallet } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { PortfolioTotals } from "@/lib/mock/site-kpi";
import { cn, formatCurrency, formatNumber } from "@/lib/utils";

export function PortfolioSummary({ totals }: { totals: PortfolioTotals }) {
  const items = [
    {
      label: "Total Sales",
      value: formatCurrency(totals.sales),
      icon: Landmark,
      tone: "text-primary",
    },
    {
      label: "Total Cost",
      value: formatCurrency(totals.cost),
      icon: Wallet,
      tone: "text-amber-600",
    },
    {
      label: "Net Margin",
      value: formatCurrency(totals.netMargin),
      hint: `${totals.marginPct.toFixed(1)}% GP`,
      icon: PiggyBank,
      tone: "text-emerald-600",
    },
    {
      label: "SLA Rata-Rata",
      value: `${totals.slaPct.toFixed(1)}%`,
      icon: ShieldCheck,
      tone: totals.slaPct >= 90 ? "text-emerald-600" : totals.slaPct >= 80 ? "text-amber-600" : "text-rose-600",
    },
    {
      label: "Approval Pending",
      value: formatNumber(totals.pendingApprovals),
      icon: Clock3,
      tone: "text-sky-600",
    },
    {
      label: "Invoice Overdue",
      value: formatNumber(totals.overdueInvoices),
      icon: AlertTriangle,
      tone: totals.overdueInvoices > 0 ? "text-rose-600" : "text-muted-foreground",
    },
    {
      label: "Sites",
      value: formatNumber(totals.siteCount),
      icon: Layers,
      tone: "text-muted-foreground",
    },
  ];

  return (
    <Card>
      <CardContent className="grid grid-cols-2 divide-x divide-y p-0 sm:grid-cols-4 lg:grid-cols-7">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="p-4">
              <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                <Icon className={cn("h-3.5 w-3.5", item.tone)} />
                {item.label}
              </div>
              <div className="mt-2 truncate text-lg font-semibold tabular-nums">{item.value}</div>
              {"hint" in item && item.hint && (
                <div className="text-[11px] text-muted-foreground">{item.hint}</div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
