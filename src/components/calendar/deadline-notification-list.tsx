"use client";

import Link from "next/link";
import { AlarmClock, ArrowRight, BellRing, CalendarClock, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { KIND_META, STATUS_META, type DeadlineItem } from "@/lib/mock/deadlines";
import { cn } from "@/lib/utils";

/**
 * Compact, urgency-sorted deadline notification feed for the calendar
 * sidebar. Overdue and due-today items float to the top.
 */
export function DeadlineNotificationList({ items }: { items: DeadlineItem[] }) {
  const urgent = items
    .filter((i) => i.status !== "settled")
    .sort((a, b) => a.daysRelative - b.daysRelative)
    .slice(0, 12);

  const overdueCount = items.filter((i) => i.status === "overdue").length;
  const dueTodayCount = items.filter((i) => i.status === "due_today").length;

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <BellRing className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Notifikasi Deadline</span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px]">
          {overdueCount > 0 && (
            <Badge variant="danger" className="tabular-nums">{overdueCount} overdue</Badge>
          )}
          {dueTodayCount > 0 && (
            <Badge variant="warning" className="tabular-nums">{dueTodayCount} hari ini</Badge>
          )}
        </div>
      </div>

      {urgent.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          Tidak ada deadline mendesak.
        </div>
      ) : (
        <ul className="divide-y">
          {urgent.map((item) => {
            const meta = STATUS_META[item.status];
            const Icon =
              item.status === "overdue"
                ? AlarmClock
                : item.status === "due_today" || item.status === "due_soon"
                  ? CalendarClock
                  : BellRing;
            return (
              <li key={item.id} className="flex items-start gap-3 px-4 py-2.5">
                <div
                  className={cn(
                    "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
                    item.status === "overdue"
                      ? "bg-rose-50 text-rose-600"
                      : item.status === "due_today" || item.status === "due_soon"
                        ? "bg-amber-50 text-amber-600"
                        : "bg-sky-50 text-sky-600",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">{item.title}</span>
                    <span
                      className={cn(
                        "shrink-0 text-[11px] tabular-nums",
                        item.status === "overdue"
                          ? "font-medium text-rose-600"
                          : "text-muted-foreground",
                      )}
                    >
                      {item.dueLabel}
                    </span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span>{KIND_META[item.kind].label}</span>
                    <Badge variant="outline" className="h-4 px-1">{item.projectCode}</Badge>
                    <Badge variant="muted" className="h-4 px-1">{item.locationName}</Badge>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground">{item.dueDate}</span>
                    <Link
                      href={`/site/${item.locationId}`}
                      className="inline-flex items-center gap-0.5 text-[11px] font-medium text-primary hover:underline"
                    >
                      Buka
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
