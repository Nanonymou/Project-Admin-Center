"use client";

import {
  AlertTriangle,
  BadgeCheck,
  Clock3,
  FileClock,
  PiggyBank,
  Receipt,
  ShieldCheck,
  ShoppingCart,
  Wallet,
} from "lucide-react";
import { KpiCard, type KpiCardProps } from "@/components/common/kpi-card";
import type { SiteKpi } from "@/lib/mock/site-kpi";
import type { ComputedSiteKpi } from "@/lib/mock/site-kpi-calc";

/**
 * The 8 primary site KPIs, driven by KPI values computed from raw daily +
 * invoice data (site-kpi-calc). Tax is config-driven per project.
 */
export function SiteKpiGrid({
  site,
  computed,
}: {
  site: SiteKpi;
  computed: ComputedSiteKpi;
}) {
  const salesDelta = site.prevPeriod
    ? ((site.sales - site.prevPeriod.sales) / Math.max(1, site.prevPeriod.sales)) * 100
    : undefined;
  const marginDelta = site.prevPeriod ? site.marginPct - site.prevPeriod.marginPct : undefined;
  const slaDelta = site.prevPeriod ? site.slaPct - site.prevPeriod.slaPct : undefined;

  const tiles: KpiCardProps[] = [
    {
      label: "Gross Sales",
      value: computed.grossSales,
      format: "currency",
      icon: ShoppingCart,
      tone: "primary",
      delta: salesDelta,
      deltaSuffix: "%",
      deltaLabel: "vs periode lalu",
      sub: `Avg ${formatCompactSub(computed.avgDailySales)}/hari`,
    },
    {
      label: "Total Cost",
      value: computed.totalCost,
      format: "currency",
      icon: Wallet,
      tone: "warning",
    },
    {
      label: "Net Margin",
      value: computed.netMargin,
      format: "currency",
      sub: `${computed.marginPct.toFixed(1)}% GP`,
      icon: PiggyBank,
      tone: "success",
      delta: marginDelta,
      deltaLabel: "poin margin",
    },
    {
      label: `${computed.taxLabel} + Net Invoice`,
      value: computed.netInvoiceValue,
      format: "currency",
      sub: `Pajak ${formatCompactSub(computed.taxAmount)}`,
      icon: Receipt,
      tone: "info",
    },
    {
      label: "SLA Compliance",
      value: computed.slaPct,
      format: "percent",
      icon: ShieldCheck,
      tone: computed.slaPct >= 90 ? "success" : computed.slaPct >= 80 ? "warning" : "danger",
      delta: slaDelta,
      deltaLabel: "poin SLA",
    },
    {
      label: "Approval Pending",
      value: computed.pendingApprovals,
      format: "number",
      sub: "menunggu review",
      icon: Clock3,
      tone: computed.pendingApprovals > 5 ? "warning" : "info",
    },
    {
      label: "Invoice Overdue",
      value: computed.overdueInvoices,
      format: "number",
      sub: computed.overdueInvoices > 0 ? "escalation aktif" : "tidak ada",
      icon: AlertTriangle,
      tone: computed.overdueInvoices > 0 ? "danger" : "muted",
    },
    {
      label: "Outstanding",
      value: computed.outstandingCount,
      format: "number",
      sub: formatCompactSub(computed.outstandingAmount),
      icon: FileClock,
      tone: "info",
    },
  ];

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {tiles.map((tile) => (
          <KpiCard key={tile.label} {...tile} />
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
        <BadgeCheck className="h-3.5 w-3.5" />
        Cut-off{" "}
        <b className="text-foreground">
          {site.cutOffDaysLeft > 0 ? `H-${site.cutOffDaysLeft}` : "hari ini"}
        </b>{" "}
        · status {statusLabel(site.closingStatus)} · {computed.activeDays} hari data ·
        pajak dihitung {computed.taxLabel} (config per project)
      </div>
    </div>
  );
}

function formatCompactSub(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `Rp ${(value / 1_000_000_000).toFixed(1)} M`;
  if (abs >= 1_000_000) return `Rp ${(value / 1_000_000).toFixed(0)} jt`;
  if (abs >= 1_000) return `Rp ${(value / 1_000).toFixed(0)} rb`;
  return `Rp ${value}`;
}

function statusLabel(status: SiteKpi["closingStatus"]) {
  if (status === "locked") return "Period locked";
  if (status === "closing") return "Closing window";
  return "Period open";
}
