"use client";

import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BadgeCheck,
  Clock3,
  FileClock,
  Minus,
  PiggyBank,
  ShieldCheck,
  ShoppingCart,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { SiteKpi } from "@/lib/mock/site-kpi";
import { cn, formatCurrency, formatNumber } from "@/lib/utils";

type Tone = "primary" | "success" | "warning" | "danger" | "info" | "muted";

type KpiTile = {
  key: string;
  label: string;
  value: string;
  sub?: string;
  delta?: number;
  deltaLabel?: string;
  icon: LucideIcon;
  tone: Tone;
};

const TONE_CLASS: Record<Tone, string> = {
  primary: "text-primary bg-primary/10",
  success: "text-emerald-700 bg-emerald-50",
  warning: "text-amber-700 bg-amber-50",
  danger: "text-rose-700 bg-rose-50",
  info: "text-sky-700 bg-sky-50",
  muted: "text-muted-foreground bg-muted",
};

/**
 * The 8 primary site KPIs. `periodFactor` lets volume metrics track the
 * global period; intensive metrics (margin %, SLA %) stay absolute.
 */
export function SiteKpiGrid({
  site,
  periodFactor = 1,
  invoiceCount,
}: {
  site: SiteKpi;
  periodFactor?: number;
  invoiceCount: number;
}) {
  const scaledSales = Math.round(site.sales * periodFactor);
  const scaledCost = Math.round(site.cost * periodFactor);
  const scaledMargin = Math.round(site.netMargin * periodFactor);

  const salesDelta = site.prevPeriod
    ? ((site.sales - site.prevPeriod.sales) / Math.max(1, site.prevPeriod.sales)) * 100
    : undefined;
  const marginDelta = site.prevPeriod ? site.marginPct - site.prevPeriod.marginPct : undefined;
  const slaDelta = site.prevPeriod ? site.slaPct - site.prevPeriod.slaPct : undefined;

  const tiles: KpiTile[] = [
    {
      key: "sales",
      label: "Total Sales",
      value: formatCurrency(scaledSales),
      icon: ShoppingCart,
      tone: "primary",
      delta: salesDelta,
      deltaLabel: "vs periode lalu",
    },
    {
      key: "cost",
      label: "Total Cost",
      value: formatCurrency(scaledCost),
      icon: Wallet,
      tone: "warning",
    },
    {
      key: "margin",
      label: "Net Margin",
      value: formatCurrency(scaledMargin),
      sub: `${site.marginPct.toFixed(1)}% GP`,
      icon: PiggyBank,
      tone: "success",
      delta: marginDelta,
      deltaLabel: "poin margin",
    },
    {
      key: "sla",
      label: "SLA Compliance",
      value: `${site.slaPct}%`,
      icon: ShieldCheck,
      tone: site.slaPct >= 90 ? "success" : site.slaPct >= 80 ? "warning" : "danger",
      delta: slaDelta,
      deltaLabel: "poin SLA",
    },
    {
      key: "pending",
      label: "Approval Pending",
      value: formatNumber(site.pendingApprovals),
      sub: "menunggu review",
      icon: Clock3,
      tone: site.pendingApprovals > 5 ? "warning" : "info",
    },
    {
      key: "overdue",
      label: "Invoice Overdue",
      value: formatNumber(site.overdueInvoices),
      sub: site.overdueInvoices > 0 ? "escalation aktif" : "tidak ada",
      icon: AlertTriangle,
      tone: site.overdueInvoices > 0 ? "danger" : "muted",
    },
    {
      key: "outstanding",
      label: "Invoice Outstanding",
      value: formatNumber(invoiceCount),
      sub: "belum settled",
      icon: FileClock,
      tone: "info",
    },
    {
      key: "closing",
      label: "Cut-Off",
      value: site.cutOffDaysLeft > 0 ? `H-${site.cutOffDaysLeft}` : "Hari ini",
      sub: statusLabel(site.closingStatus),
      icon: BadgeCheck,
      tone:
        site.closingStatus === "locked"
          ? "success"
          : site.cutOffDaysLeft <= 1
            ? "danger"
            : site.cutOffDaysLeft <= 3
              ? "warning"
              : "muted",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {tiles.map((tile) => (
        <KpiTileCard key={tile.key} tile={tile} />
      ))}
    </div>
  );
}

function KpiTileCard({ tile }: { tile: KpiTile }) {
  const Icon = tile.icon;
  const hasDelta = typeof tile.delta === "number";
  const positive = hasDelta && (tile.delta as number) > 0.05;
  const negative = hasDelta && (tile.delta as number) < -0.05;
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {tile.label}
          </span>
          <span className={cn("flex h-6 w-6 items-center justify-center rounded", TONE_CLASS[tile.tone])}>
            <Icon className="h-3.5 w-3.5" />
          </span>
        </div>
        <div className="mt-2 truncate text-xl font-semibold tabular-nums">{tile.value}</div>
        <div className="mt-1 flex items-center justify-between gap-2">
          {tile.sub && <span className="truncate text-[11px] text-muted-foreground">{tile.sub}</span>}
          {hasDelta && (
            <span
              className={cn(
                "ml-auto inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] font-semibold tabular-nums",
                positive && "bg-emerald-50 text-emerald-700",
                negative && "bg-rose-50 text-rose-700",
                !positive && !negative && "bg-muted text-muted-foreground",
              )}
              title={tile.deltaLabel}
            >
              {positive && <ArrowUpRight className="h-3 w-3" />}
              {negative && <ArrowDownRight className="h-3 w-3" />}
              {!positive && !negative && <Minus className="h-3 w-3" />}
              {Math.abs(tile.delta as number).toFixed(1)}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function statusLabel(status: SiteKpi["closingStatus"]) {
  if (status === "locked") return "Period locked";
  if (status === "closing") return "Closing window";
  return "Period open";
}
