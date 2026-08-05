"use client";

import {
  AlertTriangle,
  BadgeCheck,
  Clock3,
  FileClock,
  PiggyBank,
  ShieldCheck,
  ShoppingCart,
  Wallet,
} from "lucide-react";
import { KpiCard, type KpiCardProps } from "@/components/common/kpi-card";
import type { SiteKpi } from "@/lib/mock/site-kpi";

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

  const tiles: KpiCardProps[] = [
    {
      label: "Total Sales",
      value: scaledSales,
      format: "currency",
      icon: ShoppingCart,
      tone: "primary",
      delta: salesDelta,
      deltaSuffix: "%",
      deltaLabel: "vs periode lalu",
    },
    {
      label: "Total Cost",
      value: scaledCost,
      format: "currency",
      icon: Wallet,
      tone: "warning",
    },
    {
      label: "Net Margin",
      value: scaledMargin,
      format: "currency",
      sub: `${site.marginPct.toFixed(1)}% GP`,
      icon: PiggyBank,
      tone: "success",
      delta: marginDelta,
      deltaLabel: "poin margin",
    },
    {
      label: "SLA Compliance",
      value: site.slaPct,
      format: "percent",
      icon: ShieldCheck,
      tone: site.slaPct >= 90 ? "success" : site.slaPct >= 80 ? "warning" : "danger",
      delta: slaDelta,
      deltaLabel: "poin SLA",
    },
    {
      label: "Approval Pending",
      value: site.pendingApprovals,
      format: "number",
      sub: "menunggu review",
      icon: Clock3,
      tone: site.pendingApprovals > 5 ? "warning" : "info",
    },
    {
      label: "Invoice Overdue",
      value: site.overdueInvoices,
      format: "number",
      sub: site.overdueInvoices > 0 ? "escalation aktif" : "tidak ada",
      icon: AlertTriangle,
      tone: site.overdueInvoices > 0 ? "danger" : "muted",
    },
    {
      label: "Invoice Outstanding",
      value: invoiceCount,
      format: "number",
      sub: "belum settled",
      icon: FileClock,
      tone: "info",
    },
    {
      label: "Cut-Off",
      value: site.cutOffDaysLeft > 0 ? `H-${site.cutOffDaysLeft}` : "Hari ini",
      format: "text",
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
        <KpiCard key={tile.label} {...tile} />
      ))}
    </div>
  );
}

function statusLabel(status: SiteKpi["closingStatus"]) {
  if (status === "locked") return "Period locked";
  if (status === "closing") return "Closing window";
  return "Period open";
}
