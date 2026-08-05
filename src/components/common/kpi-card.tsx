"use client";

import { ArrowDownRight, ArrowUpRight, Minus, type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  cn,
  formatCurrency,
  formatCurrencyCompact,
  formatNumber,
} from "@/lib/utils";

export type KpiTone = "primary" | "success" | "warning" | "danger" | "info" | "muted";
export type KpiFormat = "currency" | "currency-compact" | "number" | "percent" | "text";

const TONE_CLASS: Record<KpiTone, string> = {
  primary: "text-primary bg-primary/10",
  success: "text-emerald-700 bg-emerald-50",
  warning: "text-amber-700 bg-amber-50",
  danger: "text-rose-700 bg-rose-50",
  info: "text-sky-700 bg-sky-50",
  muted: "text-muted-foreground bg-muted",
};

export type KpiCardProps = {
  label: string;
  value: number | string;
  format?: KpiFormat;
  sub?: string;
  icon?: LucideIcon;
  tone?: KpiTone;
  /** Numeric delta shown as a colored chip (e.g. % change). */
  delta?: number;
  /** Suffix appended to the delta, e.g. "%". */
  deltaSuffix?: string;
  deltaLabel?: string;
  /** When true a positive delta is bad (e.g. overdue), so colors invert. */
  invertDelta?: boolean;
  className?: string;
};

export function formatKpiValue(value: number | string, format: KpiFormat): string {
  if (typeof value === "string") return value;
  switch (format) {
    case "currency":
      return formatCurrency(value);
    case "currency-compact":
      return formatCurrencyCompact(value);
    case "percent":
      return `${value.toFixed(1)}%`;
    case "number":
      return formatNumber(value);
    default:
      return String(value);
  }
}

export function KpiCard({
  label,
  value,
  format = "number",
  sub,
  icon: Icon,
  tone = "muted",
  delta,
  deltaSuffix = "",
  deltaLabel,
  invertDelta = false,
  className,
}: KpiCardProps) {
  const hasDelta = typeof delta === "number";
  const rawPositive = hasDelta && (delta as number) > 0.05;
  const rawNegative = hasDelta && (delta as number) < -0.05;
  // "good" = green. Invert flips which direction is green.
  const good = invertDelta ? rawNegative : rawPositive;
  const bad = invertDelta ? rawPositive : rawNegative;

  return (
    <Card className={className}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </span>
          {Icon && (
            <span className={cn("flex h-6 w-6 items-center justify-center rounded", TONE_CLASS[tone])}>
              <Icon className="h-3.5 w-3.5" />
            </span>
          )}
        </div>
        <div className="mt-2 truncate text-xl font-semibold tabular-nums">
          {formatKpiValue(value, format)}
        </div>
        <div className="mt-1 flex items-center justify-between gap-2">
          {sub && <span className="truncate text-[11px] text-muted-foreground">{sub}</span>}
          {hasDelta && (
            <span
              className={cn(
                "ml-auto inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] font-semibold tabular-nums",
                good && "bg-emerald-50 text-emerald-700",
                bad && "bg-rose-50 text-rose-700",
                !good && !bad && "bg-muted text-muted-foreground",
              )}
              title={deltaLabel}
            >
              {rawPositive && <ArrowUpRight className="h-3 w-3" />}
              {rawNegative && <ArrowDownRight className="h-3 w-3" />}
              {!rawPositive && !rawNegative && <Minus className="h-3 w-3" />}
              {Math.abs(delta as number).toFixed(1)}
              {deltaSuffix}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
