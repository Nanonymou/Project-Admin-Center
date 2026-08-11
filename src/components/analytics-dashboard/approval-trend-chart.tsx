"use client";

import { useMemo } from "react";

const WEEKS = ["W-5", "W-4", "W-3", "W-2", "W-1", "Ini"];

export type ApprovalTrendPoint = { week: string; approved: number; pending: number };

/**
 * Build a deterministic 6-week approval trend (approved vs still-pending counts)
 * from a base weekly volume — usually derived from the scoped portfolio's pending
 * approvals. Seeded so it is stable across renders; approvals dominate while a
 * small pending tail remains. Frontend-first mock for the Analytics Dashboard.
 */
export function buildApprovalTrend(baseWeekly: number): ApprovalTrendPoint[] {
  const base = Math.max(6, baseWeekly);
  return WEEKS.map((week, i) => {
    const wave = 0.8 + Math.abs(Math.sin((i + 1) * 1.3)) * 0.5; // 0.8..1.3
    const total = Math.round(base * wave);
    const pending = Math.max(0, Math.round(total * (0.1 + Math.abs(Math.sin((i + 3) * 2.1)) * 0.2)));
    return { week, approved: total - pending, pending };
  });
}

/**
 * Approval Trend — approved vs pending approval counts over the last 6 weeks,
 * drawn as lightweight stacked bars (no chart library). Presentational.
 */
export function ApprovalTrendChart({ data }: { data: ApprovalTrendPoint[] }) {
  const max = useMemo(() => Math.max(1, ...data.map((d) => d.approved + d.pending)), [data]);

  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Tidak ada data.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Disetujui
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-amber-400" /> Pending
        </span>
      </div>
      <div className="flex items-end gap-3" style={{ height: 190 }}>
        {data.map((d) => {
          const total = d.approved + d.pending;
          return (
            <div key={d.week} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-[10px] text-muted-foreground">{total}</span>
              <div className="flex w-full flex-1 flex-col justify-end">
                <div
                  className="w-full rounded-t bg-amber-400"
                  style={{ height: `${(d.pending / max) * 100}%` }}
                  title={`Pending ${d.week}: ${d.pending}`}
                />
                <div
                  className="w-full bg-emerald-500"
                  style={{ height: `${(d.approved / max) * 100}%` }}
                  title={`Disetujui ${d.week}: ${d.approved}`}
                />
              </div>
              <span className="text-[10px] text-muted-foreground">{d.week}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
