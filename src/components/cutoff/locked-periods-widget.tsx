"use client";

import { useMemo } from "react";
import { Lock, LockOpen } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { SiteKpi } from "@/lib/mock/site-kpi";
import { cn } from "@/lib/utils";

type ProjectLockRow = {
  projectCode: string;
  locked: number;
  closing: number;
  open: number;
  total: number;
};

function seedOf(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffffffff;
  return Math.abs(h);
}

/**
 * Aggregates locked-period counts. Each site contributes recent monthly
 * periods; how many are locked is derived from its closing status + a
 * deterministic history.
 */
export function LockedPeriodsWidget({ sites }: { sites: SiteKpi[] }) {
  const { rows, totals } = useMemo(() => {
    const map = new Map<string, ProjectLockRow>();
    let lockedTotal = 0;
    let grandTotal = 0;
    for (const site of sites) {
      const seed = seedOf(site.locationId);
      const historyMonths = 6;
      // Most past months are locked; current follows closingStatus.
      const lockedPast = historyMonths - 1;
      const currentLocked = site.closingStatus === "locked";
      const currentClosing = site.closingStatus === "closing";
      const siteLocked = lockedPast + (currentLocked ? 1 : 0);
      const row =
        map.get(site.projectCode) ??
        { projectCode: site.projectCode, locked: 0, closing: 0, open: 0, total: 0 };
      row.locked += siteLocked;
      row.closing += currentClosing ? 1 : 0;
      row.open += !currentLocked && !currentClosing ? 1 : 0;
      row.total += historyMonths;
      map.set(site.projectCode, row);
      lockedTotal += siteLocked;
      grandTotal += historyMonths;
      void seed;
    }
    return {
      rows: Array.from(map.values()).sort((a, b) => b.locked - a.locked),
      totals: { lockedTotal, grandTotal },
    };
  }, [sites]);

  const lockedPct = totals.grandTotal === 0 ? 0 : (totals.lockedTotal / totals.grandTotal) * 100;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-emerald-600" />
            Jumlah Periode Terkunci
          </CardTitle>
          <CardDescription>Periode yang sudah di-lock (final) per project — 6 bulan terakhir.</CardDescription>
        </div>
        <div className="text-right">
          <div className="text-2xl font-semibold tabular-nums">{totals.lockedTotal}</div>
          <div className="text-[11px] text-muted-foreground">{lockedPct.toFixed(0)}% dari total</div>
        </div>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Tidak ada data periode.
          </div>
        ) : (
          <ul className="divide-y">
            {rows.map((r) => {
              const pct = r.total === 0 ? 0 : (r.locked / r.total) * 100;
              return (
                <li key={r.projectCode} className="flex items-center gap-3 py-2.5">
                  <div className="flex h-9 w-12 shrink-0 items-center justify-center rounded bg-primary/10 text-[11px] font-bold text-primary">
                    {r.projectCode}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-medium tabular-nums">{r.locked} terkunci</span>
                      <span className="text-[11px] text-muted-foreground">
                        {r.closing > 0 && (
                          <span className="mr-2 inline-flex items-center gap-0.5 text-amber-600">
                            <LockOpen className="h-3 w-3" />
                            {r.closing} closing
                          </span>
                        )}
                        {r.open > 0 && <span>{r.open} open</span>}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded bg-muted">
                      <div className={cn("h-full rounded bg-emerald-500")} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">
                    {pct.toFixed(0)}%
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
