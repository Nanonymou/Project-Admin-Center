"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { AggregateTimelineRow } from "@/lib/mock/aggregate-timeline";
import type { TimelineStageState } from "@/lib/mock/approval-timeline";
import { invoiceHref } from "@/lib/mock/invoice-lookup";
import { cn, formatCurrency } from "@/lib/utils";

export const GANTT_STATE_COLOR: Record<TimelineStageState, string> = {
  done: "bg-emerald-500",
  current: "bg-primary",
  overdue: "bg-rose-500",
  upcoming: "bg-muted-foreground/25",
};

const GANTT_STATE_LABEL: Record<TimelineStageState, string> = {
  done: "Selesai",
  current: "Berjalan",
  overdue: "Overdue",
  upcoming: "Belum mulai",
};

/**
 * Status → colour logic for a Gantt bar. A running stage that is within 20% of
 * its SLA (but not yet breached) is highlighted amber as "at risk"; a breached
 * SLA always reads as overdue red regardless of the raw state.
 */
export function ganttStageColor(s: {
  state: TimelineStageState;
  slaDays: number;
  durationDays: number;
  breachedSla: boolean;
}): { className: string; atRisk: boolean } {
  if (s.breachedSla) return { className: "bg-rose-500", atRisk: false };
  if (s.state === "current" && s.slaDays > 0 && s.durationDays >= s.slaDays * 0.8) {
    return { className: "bg-amber-500", atRisk: true };
  }
  return { className: GANTT_STATE_COLOR[s.state], atRisk: false };
}

/**
 * Reusable, color-coded Gantt chart with a day-scale ruler. Rows are
 * pre-computed timeline entries; the chart handles the axis + scaling.
 */
export function GanttChart({
  rows,
  maxSpan,
  onSelect,
}: {
  rows: AggregateTimelineRow[];
  maxSpan: number;
  onSelect?: (row: AggregateTimelineRow) => void;
}) {
  // Ruler ticks roughly every ~5 days (at least 4 ticks).
  const tickStep = Math.max(1, Math.ceil(maxSpan / 8));
  const ticks: number[] = [];
  for (let d = 0; d <= maxSpan; d += tickStep) ticks.push(d);

  // Hovering a stage bar highlights the same stage across every row.
  const [hoveredStage, setHoveredStage] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
        {(Object.keys(GANTT_STATE_COLOR) as TimelineStageState[]).map((state) => (
          <span key={state} className="inline-flex items-center gap-1.5">
            <span className={cn("h-2.5 w-2.5 rounded-sm", GANTT_STATE_COLOR[state])} />
            {GANTT_STATE_LABEL[state]}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-amber-500" />
          At Risk (mendekati SLA)
        </span>
        <span className="ml-auto">Skala: hari sejak invoice dibuat · outline putus-putus = SLA lewat</span>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[640px]">
          {/* Ruler */}
          <div className="grid grid-cols-[minmax(0,220px),1fr] items-end gap-2 border-b pb-1">
            <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Invoice
            </div>
            <div className="relative h-4">
              {ticks.map((d) => (
                <span
                  key={d}
                  className="absolute -translate-x-1/2 text-[10px] tabular-nums text-muted-foreground"
                  style={{ left: `${(d / maxSpan) * 100}%` }}
                >
                  {d}h
                </span>
              ))}
            </div>
          </div>

          {/* Rows */}
          <div className="divide-y">
            {rows.map((row) => (
              <GanttRow
                key={`${row.locationId}-${row.invoiceNumber}`}
                row={row}
                maxSpan={maxSpan}
                ticks={ticks}
                onSelect={onSelect}
                hoveredStage={hoveredStage}
                onHoverStage={setHoveredStage}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function GanttRow({
  row,
  maxSpan,
  ticks,
  onSelect,
  hoveredStage,
  onHoverStage,
}: {
  row: AggregateTimelineRow;
  maxSpan: number;
  ticks: number[];
  onSelect?: (row: AggregateTimelineRow) => void;
  hoveredStage: string | null;
  onHoverStage: (stage: string | null) => void;
}) {
  const statusVariant =
    row.status === "overdue" ? "danger" : row.status === "atRisk" ? "warning" : "success";
  return (
    <div
      className={cn(
        "grid grid-cols-[minmax(0,220px),1fr] items-center gap-2 py-1.5",
        onSelect && "cursor-pointer rounded hover:bg-accent/50",
      )}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("a")) return;
        onSelect?.(row);
      }}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <Link
            href={invoiceHref(row.invoiceNumber)}
            className="truncate text-xs font-medium tabular-nums text-primary hover:underline"
          >
            {row.invoiceNumber}
          </Link>
          <Badge variant={statusVariant} className="h-4 shrink-0 px-1 text-[10px]">
            {row.currentStage}
          </Badge>
        </div>
        <div className="mt-0.5 truncate text-[10px] text-muted-foreground">
          {row.projectCode} · {row.locationName} · {formatCurrency(row.amount)}
        </div>
      </div>
      <div className="relative h-6">
        {/* Gridlines */}
        {ticks.map((d) => (
          <span
            key={d}
            className="absolute top-0 h-full w-px bg-border/60"
            style={{ left: `${(d / maxSpan) * 100}%` }}
          />
        ))}
        {/* Bars — absolutely positioned per stage offset */}
        {row.stages.map((s) => {
          const leftPct = (s.startOffset / maxSpan) * 100;
          const widthPct = (s.durationDays / maxSpan) * 100;
          const color = ganttStageColor(s);
          return (
            <div
              key={s.stage}
              onMouseEnter={() => onHoverStage(s.stage)}
              onMouseLeave={() => onHoverStage(null)}
              className={cn(
                "absolute top-1/2 h-4 -translate-y-1/2 overflow-hidden rounded-sm transition-all",
                color.className,
                s.breachedSla && "outline outline-1 outline-dashed outline-rose-900/50",
                hoveredStage === s.stage && "z-10 ring-2 ring-foreground/60",
                hoveredStage && hoveredStage !== s.stage && "opacity-40",
              )}
              style={{ left: `${leftPct}%`, width: `${Math.max(1.5, widthPct)}%` }}
              title={`${s.stage}: ${s.state === "upcoming" ? `SLA ${s.slaDays}h` : `${s.durationDays}h`}${s.breachedSla ? " (SLA lewat)" : color.atRisk ? " (mendekati SLA)" : ""} · ${s.actor}`}
            />
          );
        })}
      </div>
    </div>
  );
}
