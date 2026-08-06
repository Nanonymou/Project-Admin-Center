"use client";

import { useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { SiteKpi } from "@/lib/mock/site-kpi";
import { cn, formatCurrency } from "@/lib/utils";

type MetricRow = {
  key: string;
  label: string;
  value: (s: SiteKpi) => number;
  format: (n: number) => string;
  /** higher is better (default) — controls which side is highlighted */
  higherBetter?: boolean;
};

const METRICS: MetricRow[] = [
  { key: "sales", label: "Sales", value: (s) => s.sales, format: formatCurrency },
  { key: "cost", label: "Cost", value: (s) => s.cost, format: formatCurrency, higherBetter: false },
  { key: "netMargin", label: "Net Margin", value: (s) => s.netMargin, format: formatCurrency },
  { key: "marginPct", label: "Margin %", value: (s) => s.marginPct, format: (n) => `${n.toFixed(1)}%` },
  { key: "slaPct", label: "SLA", value: (s) => s.slaPct, format: (n) => `${n}%` },
  { key: "pending", label: "Approval Pending", value: (s) => s.pendingApprovals, format: (n) => `${n}`, higherBetter: false },
  { key: "overdue", label: "Invoice Overdue", value: (s) => s.overdueInvoices, format: (n) => `${n}`, higherBetter: false },
];

/**
 * Generic two-location comparison. Works for any pair of sites in the
 * provided list (defaults to the first two). No hardcoded location names.
 */
export function LocationComparison({ sites }: { sites: SiteKpi[] }) {
  const [leftId, setLeftId] = useState(sites[0]?.locationId ?? "");
  const [rightId, setRightId] = useState(sites[1]?.locationId ?? sites[0]?.locationId ?? "");

  const left = useMemo(() => sites.find((s) => s.locationId === leftId) ?? sites[0], [sites, leftId]);
  const right = useMemo(
    () => sites.find((s) => s.locationId === rightId) ?? sites[1] ?? sites[0],
    [sites, rightId],
  );

  // Tally which side wins across the metrics for a head-to-head verdict.
  const tally = useMemo(() => {
    if (!left || !right) return { left: 0, right: 0 };
    let l = 0;
    let r = 0;
    for (const m of METRICS) {
      const lv = m.value(left);
      const rv = m.value(right);
      const higherBetter = m.higherBetter ?? true;
      if (higherBetter ? lv > rv : lv < rv) l++;
      else if (higherBetter ? rv > lv : rv < lv) r++;
    }
    return { left: l, right: r };
  }, [left, right]);

  if (sites.length < 2 || !left || !right) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Perbandingan Lokasi</CardTitle>
          <CardDescription>Butuh minimal 2 location untuk dibandingkan.</CardDescription>
        </CardHeader>
        <CardContent className="py-6 text-center text-sm text-muted-foreground">
          Tidak cukup location dalam scope.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Perbandingan Lokasi</CardTitle>
        <CardDescription>Bandingkan dua location head-to-head pada periode aktif.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <LocationPicker label="Lokasi A" sites={sites} value={leftId} onChange={setLeftId} />
          <LocationPicker label="Lokasi B" sites={sites} value={rightId} onChange={setRightId} />
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-md border bg-muted/20 p-3">
          <VsSide name={left.locationName} marginPct={left.marginPct} wins={tally.left} winner={tally.left > tally.right} />
          <div className="text-center text-xs font-bold uppercase tracking-wide text-muted-foreground">vs</div>
          <VsSide name={right.locationName} marginPct={right.marginPct} wins={tally.right} winner={tally.right > tally.left} alignRight />
        </div>

        <p className="text-center text-[11px] text-muted-foreground">
          {tally.left === tally.right
            ? "Kedua lokasi imbang pada periode ini."
            : `${tally.left > tally.right ? left.locationName : right.locationName} unggul di ${Math.max(tally.left, tally.right)} dari ${METRICS.length} metrik.`}
        </p>

        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 text-left font-medium">Metrik</th>
                <th className="px-3 py-2 text-right font-medium">{left.locationName}</th>
                <th className="px-3 py-2 text-right font-medium">{right.locationName}</th>
                <th className="px-3 py-2 text-right font-medium">Selisih</th>
              </tr>
            </thead>
            <tbody>
              {METRICS.map((m) => {
                const lv = m.value(left);
                const rv = m.value(right);
                const higherBetter = m.higherBetter ?? true;
                const leftWins = higherBetter ? lv > rv : lv < rv;
                const rightWins = higherBetter ? rv > lv : rv < lv;
                const diff = lv - rv;
                return (
                  <tr key={m.key} className="border-b last:border-0">
                    <td className="px-3 py-2 text-muted-foreground">{m.label}</td>
                    <td className={cn("px-3 py-2 text-right tabular-nums", leftWins && "font-semibold text-emerald-700")}>
                      {m.format(lv)}
                    </td>
                    <td className={cn("px-3 py-2 text-right tabular-nums", rightWins && "font-semibold text-emerald-700")}>
                      {m.format(rv)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                      {diff === 0 ? "—" : m.format(Math.abs(diff))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between text-[11px]">
          <Link href={`/site/${left.locationId}`} className="inline-flex items-center gap-0.5 font-medium text-primary hover:underline">
            {left.locationName} <ArrowRight className="h-3 w-3" />
          </Link>
          <Link href={`/site/${right.locationId}`} className="inline-flex items-center gap-0.5 font-medium text-primary hover:underline">
            {right.locationName} <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function VsSide({
  name,
  marginPct,
  wins,
  winner,
  alignRight,
}: {
  name: string;
  marginPct: number;
  wins: number;
  winner: boolean;
  alignRight?: boolean;
}) {
  return (
    <div className={cn(alignRight && "text-right")}>
      <div className="flex items-center gap-1.5" style={alignRight ? { justifyContent: "flex-end" } : undefined}>
        <span className="text-sm font-semibold">{name}</span>
        {winner && (
          <span className="rounded bg-emerald-100 px-1 py-0.5 text-[9px] font-semibold uppercase text-emerald-700">
            Unggul
          </span>
        )}
      </div>
      <div className="mt-0.5 text-lg font-bold tabular-nums">{marginPct.toFixed(1)}%</div>
      <div className="text-[11px] text-muted-foreground">{wins} metrik menang</div>
    </div>
  );
}

function LocationPicker({
  label,
  sites,
  value,
  onChange,
}: {
  label: string;
  sites: SiteKpi[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-medium text-muted-foreground">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring"
      >
        {sites.map((s) => (
          <option key={s.locationId} value={s.locationId}>
            {s.projectCode} · {s.locationName}
          </option>
        ))}
      </select>
    </div>
  );
}
