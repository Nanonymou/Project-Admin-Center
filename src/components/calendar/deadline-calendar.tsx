"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight, Receipt } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { KIND_META, STATUS_META, type DeadlineItem, type DeadlineKind } from "@/lib/mock/deadlines";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

/** Invoice-related deadline kinds get a distinct marker on the calendar. */
const INVOICE_KINDS = new Set<DeadlineKind>(["invoice_submit", "payment"]);
export function isInvoiceDeadline(kind: DeadlineKind): boolean {
  return INVOICE_KINDS.has(kind);
}
const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

const STATUS_DOT: Record<DeadlineItem["status"], string> = {
  overdue: "bg-rose-500",
  due_today: "bg-amber-500",
  due_soon: "bg-amber-400",
  on_track: "bg-sky-500",
  settled: "bg-emerald-500",
};

const STATUS_CHIP: Record<DeadlineItem["status"], string> = {
  overdue: "bg-rose-100 text-rose-800 border-rose-200",
  due_today: "bg-amber-100 text-amber-900 border-amber-200",
  due_soon: "bg-amber-50 text-amber-800 border-amber-200",
  on_track: "bg-sky-50 text-sky-800 border-sky-200",
  settled: "bg-emerald-50 text-emerald-800 border-emerald-200",
};

type DayCell = {
  date: Date;
  iso: string;
  inMonth: boolean;
  items: DeadlineItem[];
};

function isoOf(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function DeadlineCalendar({ items }: { items: DeadlineItem[] }) {
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedIso, setSelectedIso] = useState<string>(() => isoOf(new Date()));
  const [activeItem, setActiveItem] = useState<DeadlineItem | null>(null);

  const byDate = useMemo(() => {
    const map = new Map<string, DeadlineItem[]>();
    for (const item of items) {
      const key = item.dueDate;
      map.set(key, [...(map.get(key) ?? []), item]);
    }
    return map;
  }, [items]);

  const cells: DayCell[] = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const first = new Date(year, month, 1);
    // Monday-based offset
    const startOffset = (first.getDay() + 6) % 7;
    const gridStart = new Date(year, month, 1 - startOffset);
    return Array.from({ length: 42 }, (_, i) => {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + i);
      const iso = isoOf(date);
      return {
        date,
        iso,
        inMonth: date.getMonth() === month,
        items: byDate.get(iso) ?? [],
      };
    });
  }, [cursor, byDate]);

  const selectedItems = byDate.get(selectedIso) ?? [];
  const todayIso = isoOf(new Date());

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr),minmax(0,1fr)]">
      <div className="rounded-lg border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-base font-semibold">
            {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7"
              onClick={() => {
                const now = new Date();
                setCursor(new Date(now.getFullYear(), now.getMonth(), 1));
                setSelectedIso(isoOf(now));
              }}
            >
              Hari ini
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-muted-foreground">
          {WEEKDAYS.map((d) => (
            <div key={d} className="py-1">{d}</div>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {cells.map((cell) => {
            const isToday = cell.iso === todayIso;
            const isSelected = cell.iso === selectedIso;
            const overdue = cell.items.some((i) => i.status === "overdue");
            return (
              <button
                key={cell.iso}
                type="button"
                onClick={() => setSelectedIso(cell.iso)}
                className={cn(
                  "flex min-h-[64px] flex-col rounded-md border p-1 text-left transition-colors sm:min-h-[88px]",
                  cell.inMonth ? "bg-background" : "bg-muted/30 text-muted-foreground",
                  isSelected && "border-primary ring-1 ring-primary",
                  !isSelected && "border-input hover:bg-accent",
                )}
              >
                <span
                  className={cn(
                    "inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] tabular-nums",
                    isToday && "bg-primary text-primary-foreground font-semibold",
                    overdue && !isToday && "text-rose-600 font-semibold",
                  )}
                >
                  {cell.date.getDate()}
                </span>
                {cell.items.length > 0 && (
                  <>
                    {/* Labeled event chips on wider screens */}
                    <div className="mt-1 hidden flex-col gap-0.5 sm:flex">
                      {cell.items.slice(0, 2).map((it) => (
                        <span
                          key={it.id}
                          className={cn(
                            "flex items-center gap-0.5 truncate rounded border px-1 py-0.5 text-[9px] font-medium leading-tight",
                            STATUS_CHIP[it.status],
                          )}
                          title={`${isInvoiceDeadline(it.kind) ? "Deadline invoice — " : ""}${it.title} · ${it.projectCode} ${it.locationName}`}
                        >
                          {isInvoiceDeadline(it.kind) && <Receipt className="h-2.5 w-2.5 shrink-0" />}
                          <span className="truncate">
                            {KIND_META[it.kind].label} · {it.projectCode}
                          </span>
                        </span>
                      ))}
                      {cell.items.length > 2 && (
                        <span className="text-[9px] text-muted-foreground">
                          +{cell.items.length - 2} lagi
                        </span>
                      )}
                    </div>
                    {/* Compact dots on small screens */}
                    <div className="mt-auto flex flex-wrap gap-0.5 sm:hidden">
                      {cell.items.slice(0, 4).map((it) => (
                        <span
                          key={it.id}
                          className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[it.status])}
                          title={it.title}
                        />
                      ))}
                      {cell.items.length > 4 && (
                        <span className="text-[9px] text-muted-foreground">+{cell.items.length - 4}</span>
                      )}
                    </div>
                  </>
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
          {(["overdue", "due_today", "due_soon", "on_track", "settled"] as DeadlineItem["status"][]).map((s) => (
            <span key={s} className="inline-flex items-center gap-1.5">
              <span className={cn("h-2 w-2 rounded-full", STATUS_DOT[s])} />
              {STATUS_META[s].label}
            </span>
          ))}
        </div>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <div className="mb-2 text-sm font-semibold">
          {new Date(selectedIso).toLocaleDateString("id-ID", {
            weekday: "long",
            day: "2-digit",
            month: "long",
            year: "numeric",
          })}
        </div>
        {selectedItems.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            Tidak ada deadline pada tanggal ini.
          </div>
        ) : (
          <ul className="space-y-2">
            {selectedItems.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => setActiveItem(item)}
                  className="w-full rounded-md border p-2.5 text-left transition-colors hover:bg-accent"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{item.title}</span>
                    <Badge variant={STATUS_META[item.status].variant}>
                      {STATUS_META[item.status].label}
                    </Badge>
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    {KIND_META[item.kind].label} · {item.projectCode} · {item.locationName}
                  </div>
                  <div className="mt-0.5 text-[11px] text-primary">Lihat detail →</div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog
        open={activeItem !== null}
        onClose={() => setActiveItem(null)}
        title={activeItem?.title}
        description={
          activeItem
            ? `${KIND_META[activeItem.kind].label} · ${activeItem.projectCode} · ${activeItem.locationName}`
            : undefined
        }
        footer={
          activeItem && (
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">
                Due {activeItem.dueLabel}
              </span>
              <Link href={`/site/${activeItem.locationId}`}>
                <Button size="sm">
                  Buka Site Dashboard
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
          )
        }
      >
        {activeItem && (
          <div className="space-y-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={STATUS_META[activeItem.status].variant}>
                {STATUS_META[activeItem.status].label}
              </Badge>
              <span className="text-xs text-muted-foreground">Due {activeItem.dueLabel}</span>
            </div>
            <DetailRow label="Target" value={activeItem.target} />
            <DetailRow label="Owner" value={activeItem.owner} />
            <DetailRow label="Kategori" value={KIND_META[activeItem.kind].label} />
            <DetailRow label="Project" value={activeItem.projectCode} />
            <DetailRow label="Location" value={activeItem.locationName} />
            <DetailRow
              label="Due date"
              value={new Date(activeItem.dueDate).toLocaleDateString("id-ID", {
                weekday: "long",
                day: "2-digit",
                month: "long",
                year: "numeric",
              })}
            />
            <div>
              <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Progress
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 flex-1 overflow-hidden rounded bg-muted">
                  <div
                    className={
                      activeItem.progressPct >= 80
                        ? "h-full bg-emerald-500"
                        : activeItem.progressPct >= 50
                          ? "h-full bg-sky-500"
                          : "h-full bg-amber-500"
                    }
                    style={{ width: `${activeItem.progressPct}%` }}
                  />
                </div>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {activeItem.progressPct}%
                </span>
              </div>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b pb-2 last:border-0">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium">{value}</span>
    </div>
  );
}
