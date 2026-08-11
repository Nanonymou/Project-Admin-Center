"use client";

import { useMemo } from "react";
import { formatCurrencyCompact } from "@/lib/utils";

const MONTHS = ["Mar", "Apr", "Mei", "Jun", "Jul", "Agu"];

export type InvoiceTrendPoint = { month: string; issued: number; paid: number };

/**
 * Build a deterministic 6-month invoice trend (issued vs paid value) from a base
 * monthly value — usually the scoped portfolio's total sales. Seeded so it is
 * stable across renders; paid trails issued to read like a realistic collection
 * curve. Frontend-first mock for the Analytics Dashboard.
 */
export function buildInvoiceTrend(baseMonthly: number): InvoiceTrendPoint[] {
  return MONTHS.map((month, i) => {
    const wave = 0.85 + Math.abs(Math.sin((i + 1) * 1.7)) * 0.3; // 0.85..1.15
    const issued = Math.round((baseMonthly * wave) / 1000) * 1000;
    const paidRatio = 0.7 + Math.abs(Math.sin((i + 2) * 2.3)) * 0.28; // 0.7..0.98
    const paid = Math.round((issued * paidRatio) / 1000) * 1000;
    return { month, issued, paid };
  });
}

/**
 * Invoice Trend — issued vs paid invoice value over the last 6 months, drawn as
 * lightweight grouped bars (no chart library). Presentational; data comes from
 * `buildInvoiceTrend`.
 */
export function InvoiceTrendChart({ data }: { data: InvoiceTrendPoint[] }) {
  const max = useMemo(() => Math.max(1, ...data.flatMap((d) => [d.issued, d.paid])), [data]);

  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Tidak ada data.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-sky-500" /> Diterbitkan
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Dibayar
        </span>
      </div>
      <div className="flex items-end gap-3" style={{ height: 200 }}>
        {data.map((d) => (
          <div key={d.month} className="flex flex-1 flex-col items-center gap-1">
            <div className="flex w-full flex-1 items-end justify-center gap-1">
              <div
                className="w-1/2 rounded-t bg-sky-500 transition-all hover:opacity-80"
                style={{ height: `${(d.issued / max) * 100}%` }}
                title={`Diterbitkan ${d.month}: ${formatCurrencyCompact(d.issued)}`}
              />
              <div
                className="w-1/2 rounded-t bg-emerald-500 transition-all hover:opacity-80"
                style={{ height: `${(d.paid / max) * 100}%` }}
                title={`Dibayar ${d.month}: ${formatCurrencyCompact(d.paid)}`}
              />
            </div>
            <span className="text-[10px] text-muted-foreground">{d.month}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
