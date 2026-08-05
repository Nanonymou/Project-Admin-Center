"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { ApprovalReminder } from "@/lib/mock/approvals";
import { cn, formatCurrencyCompact } from "@/lib/utils";

export type SiteProgressData = {
  locationId: string;
  locationName: string;
  projectCode: string;
  reminders: ApprovalReminder[];
  settledCount: number;
};

type Row = {
  locationId: string;
  locationName: string;
  projectCode: string;
  total: number;
  onTime: number;
  atRisk: number;
  overdue: number;
  settled: number;
  amount: number;
  completionPct: number;
};

function toRow(d: SiteProgressData): Row {
  const onTime = d.reminders.filter((r) => r.status === "on_time").length;
  const atRisk = d.reminders.filter((r) => r.status === "at_risk").length;
  const overdue = d.reminders.filter(
    (r) => r.status === "overdue" || r.status === "escalation",
  ).length;
  const total = d.reminders.length + d.settledCount;
  const amount = d.reminders.reduce((s, r) => s + r.amount, 0);
  return {
    locationId: d.locationId,
    locationName: d.locationName,
    projectCode: d.projectCode,
    total,
    onTime,
    atRisk,
    overdue,
    settled: d.settledCount,
    amount,
    completionPct: total === 0 ? 0 : (d.settledCount / total) * 100,
  };
}

export function SiteProgressCards({ sites }: { sites: SiteProgressData[] }) {
  const rows = sites.map(toRow).sort((a, b) => b.overdue - a.overdue || a.completionPct - b.completionPct);

  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">
        Tidak ada site dalam scope.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {rows.map((row) => {
        const health =
          row.overdue > 0 ? "danger" : row.atRisk > 0 ? "warning" : "success";
        return (
          <Card key={row.locationId}>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {row.projectCode}
                  </div>
                  <div className="text-sm font-semibold">{row.locationName}</div>
                </div>
                <span
                  className={cn(
                    "rounded px-1.5 py-0.5 text-[11px] font-semibold",
                    health === "danger" && "bg-rose-50 text-rose-700",
                    health === "warning" && "bg-amber-50 text-amber-700",
                    health === "success" && "bg-emerald-50 text-emerald-700",
                  )}
                >
                  {health === "danger" ? "Perlu aksi" : health === "warning" ? "Pantau" : "Sehat"}
                </span>
              </div>

              <div>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Completion</span>
                  <span className="tabular-nums">{row.completionPct.toFixed(0)}%</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded bg-muted">
                  <div
                    className="h-full rounded bg-primary"
                    style={{ width: `${row.completionPct}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-1.5 text-center text-[11px]">
                <Stat label="On Time" value={row.onTime} className="text-emerald-700" />
                <Stat label="At Risk" value={row.atRisk} className="text-amber-700" />
                <Stat label="Overdue" value={row.overdue} className="text-rose-700" />
                <Stat label="Settled" value={row.settled} className="text-muted-foreground" />
              </div>

              <div className="flex items-center justify-between border-t pt-2 text-[11px] text-muted-foreground">
                <span className="tabular-nums">{formatCurrencyCompact(row.amount)} in-flight</span>
                <Link
                  href={`/site/${row.locationId}`}
                  className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                >
                  Detail
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function Stat({ label, value, className }: { label: string; value: number; className?: string }) {
  return (
    <div className="rounded-md border bg-background p-1.5">
      <div className={cn("text-sm font-semibold tabular-nums", className)}>{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}
