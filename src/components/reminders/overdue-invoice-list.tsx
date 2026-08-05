"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertOctagon,
  ArrowUpRight,
  BellPlus,
  CheckCircle2,
  Filter,
  Flag,
  Search,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BUCKET_COLOR,
  SEVERITY_META,
  summarizeOverdue,
  type OverdueInvoiceItem,
  type OverdueSeverity,
} from "@/lib/mock/overdue-invoices";
import { cn, formatCurrency, formatNumber } from "@/lib/utils";

type Props = {
  items: OverdueInvoiceItem[];
  showLocationColumn?: boolean;
};

const SEVERITY_ORDER: OverdueSeverity[] = ["escalate", "critical", "watch"];

export function OverdueInvoiceList({ items, showLocationColumn = true }: Props) {
  const [severityFilter, setSeverityFilter] = useState<OverdueSeverity | "all">("all");
  const [search, setSearch] = useState("");
  const [resolved, setResolved] = useState<Set<string>>(new Set());

  const summary = useMemo(() => summarizeOverdue(items), [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      if (severityFilter !== "all" && item.severity !== severityFilter) return false;
      if (q && !item.invoiceNumber.toLowerCase().includes(q) && !item.pic.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [items, severityFilter, search]);

  function toggleResolved(id: string) {
    setResolved((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-md border border-dashed py-8 text-sm text-muted-foreground">
        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
        Tidak ada invoice terlambat dalam scope ini.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <SummaryTile label="Total Overdue" value={formatNumber(summary.totalCount)} hint={formatCurrency(summary.totalAmount)} tone="danger" />
        {SEVERITY_ORDER.map((sev) => (
          <SummaryTile
            key={sev}
            label={SEVERITY_META[sev].label}
            value={formatNumber(summary.bySeverity[sev].count)}
            hint={formatCurrency(summary.bySeverity[sev].amount)}
            tone={sev === "escalate" ? "danger" : sev === "critical" ? "danger" : "warning"}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-md border bg-card p-2">
        <span className="inline-flex items-center gap-1 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Filter className="h-3 w-3" />
          Severity
        </span>
        <SeverityChip label={`Semua · ${items.length}`} active={severityFilter === "all"} onClick={() => setSeverityFilter("all")} />
        {SEVERITY_ORDER.map((sev) => (
          <SeverityChip
            key={sev}
            label={`${SEVERITY_META[sev].label} · ${summary.bySeverity[sev].count}`}
            active={severityFilter === sev}
            tone={sev === "escalate" || sev === "critical" ? "danger" : "warning"}
            onClick={() => setSeverityFilter(sev)}
          />
        ))}
        <div className="relative ml-auto min-w-[220px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nomor invoice atau PIC…"
            className="h-8 w-full rounded-md border bg-background pl-8 pr-3 text-xs outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2 text-left font-medium">Invoice</th>
              {showLocationColumn && <th className="px-3 py-2 text-left font-medium">Site</th>}
              <th className="px-3 py-2 text-left font-medium">Aging</th>
              <th className="px-3 py-2 text-left font-medium">Severity</th>
              <th className="px-3 py-2 text-left font-medium">Follow-up</th>
              <th className="px-3 py-2 text-left font-medium">Due</th>
              <th className="px-3 py-2 text-left font-medium">PIC</th>
              <th className="px-3 py-2 text-right font-medium">Nilai</th>
              <th className="px-3 py-2 text-right font-medium">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={showLocationColumn ? 9 : 8}
                  className="px-4 py-8 text-center text-sm text-muted-foreground"
                >
                  Tidak ada invoice cocok filter aktif.
                </td>
              </tr>
            )}
            {filtered.map((item) => {
              const sev = SEVERITY_META[item.severity];
              const isResolved = resolved.has(item.id);
              return (
                <tr
                  key={item.id}
                  className={cn(
                    "border-b last:border-0 hover:bg-muted/30",
                    isResolved && "bg-emerald-50/40 opacity-70",
                  )}
                >
                  <td className="px-3 py-2">
                    <div className="text-sm font-medium tabular-nums">{item.invoiceNumber}</div>
                    <div className="text-[11px] text-muted-foreground">Stage: {item.stage}</div>
                  </td>
                  {showLocationColumn && (
                    <td className="px-3 py-2 text-muted-foreground">
                      <div className="text-sm">{item.locationName}</div>
                      <div className="text-[11px]">{item.projectCode}</div>
                    </td>
                  )}
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium text-white"
                        style={{ backgroundColor: BUCKET_COLOR[item.agingBucket] }}
                      >
                        {item.agingBucket}
                      </span>
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {item.daysLate}h lewat
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant={sev.variant} className="inline-flex items-center gap-1">
                      {item.severity === "escalate" && <AlertOctagon className="h-3 w-3" />}
                      {sev.label}
                    </Badge>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">{sev.hint}</div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="text-sm">{item.lastAction}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {item.followUpsLastWeek} follow-up minggu ini
                    </div>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{item.dueDate}</td>
                  <td className="px-3 py-2 text-muted-foreground">{item.pic}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium">
                    {formatCurrency(item.amount)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="inline-flex items-center gap-1">
                      <Button size="sm" variant="outline" className="h-7 px-2" title="Kirim reminder">
                        <BellPlus className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant={isResolved ? "default" : "outline"}
                        className="h-7 px-2"
                        title={isResolved ? "Tandai belum tuntas" : "Tandai sudah dilunasi"}
                        onClick={() => toggleResolved(item.id)}
                      >
                        <Flag className="h-3.5 w-3.5" />
                      </Button>
                      <Link
                        href={`/site/${item.locationId}`}
                        className="ml-1 inline-flex items-center gap-0.5 text-xs font-medium text-primary hover:underline"
                      >
                        Detail
                        <ArrowUpRight className="h-3 w-3" />
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="text-[11px] text-muted-foreground">
        Menampilkan <b className="text-foreground">{filtered.length}</b> dari{" "}
        <b className="text-foreground">{items.length}</b> invoice · {resolved.size} ditandai
        selesai (sementara)
      </div>
    </div>
  );
}

function SummaryTile({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone: "danger" | "warning";
}) {
  return (
    <div
      className={cn(
        "rounded-md border p-3",
        tone === "danger" ? "border-rose-200 bg-rose-50" : "border-amber-200 bg-amber-50",
      )}
    >
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground tabular-nums">{hint}</div>}
    </div>
  );
}

function SeverityChip({
  label,
  active,
  tone,
  onClick,
}: {
  label: string;
  active: boolean;
  tone?: "danger" | "warning";
  onClick: () => void;
}) {
  const activeTone =
    tone === "danger"
      ? "border-rose-500 bg-rose-500 text-white"
      : tone === "warning"
        ? "border-amber-500 bg-amber-500 text-white"
        : "border-primary bg-primary text-primary-foreground";
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md border px-2 py-1 text-[11px] font-medium transition-colors",
        active ? activeTone : "border-input bg-background hover:bg-accent",
      )}
    >
      {label}
    </button>
  );
}
