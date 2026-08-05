"use client";

import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  CLOSING_STATES,
  CLOSING_STATE_META,
  type ClosingState,
  type SiteSubmitStatus,
} from "@/lib/mock/closing-status";
import { cn } from "@/lib/utils";

export function SubmitStatusList({ rows }: { rows: SiteSubmitStatus[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">
        Tidak ada site dalam scope.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
            <th className="px-3 py-2 text-left font-medium">Site</th>
            <th className="px-3 py-2 text-left font-medium">Daily Cost</th>
            <th className="px-3 py-2 text-left font-medium">Daily Sales</th>
            <th className="px-3 py-2 text-left font-medium">Progress Closing</th>
            <th className="px-3 py-2 text-right font-medium">Entri</th>
            <th className="px-3 py-2 text-right font-medium">Update</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.locationId} className="border-b last:border-0 hover:bg-muted/30">
              <td className="px-3 py-2">
                <div className="text-sm font-medium">{row.locationName}</div>
                <div className="text-[11px] text-muted-foreground">
                  {row.projectCode} · {row.submittedBy}
                </div>
              </td>
              <td className="px-3 py-2">
                <Badge variant={CLOSING_STATE_META[row.costState].variant}>
                  {CLOSING_STATE_META[row.costState].label}
                </Badge>
              </td>
              <td className="px-3 py-2">
                <Badge variant={CLOSING_STATE_META[row.salesState].variant}>
                  {CLOSING_STATE_META[row.salesState].label}
                </Badge>
              </td>
              <td className="px-3 py-2">
                <StepProgress state={row.costState} />
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{row.entriesToday}</td>
              <td className="px-3 py-2 text-right text-[11px] text-muted-foreground">
                {row.lastUpdated}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StepProgress({ state }: { state: ClosingState }) {
  const current = CLOSING_STATE_META[state].step;
  return (
    <div className="flex items-center gap-1">
      {CLOSING_STATES.map((s, i) => {
        const step = i + 1;
        const done = step < current;
        const active = step === current;
        return (
          <div key={s} className="flex items-center gap-1">
            <div
              className={cn(
                "flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-semibold",
                done && "bg-emerald-500 text-white",
                active && "bg-primary text-primary-foreground ring-2 ring-primary/30",
                !done && !active && "bg-muted text-muted-foreground",
              )}
              title={CLOSING_STATE_META[s].label}
            >
              {done ? <Check className="h-2.5 w-2.5" /> : step}
            </div>
            {i < CLOSING_STATES.length - 1 && (
              <div className={cn("h-px w-3", step < current ? "bg-emerald-500" : "bg-border")} />
            )}
          </div>
        );
      })}
    </div>
  );
}
