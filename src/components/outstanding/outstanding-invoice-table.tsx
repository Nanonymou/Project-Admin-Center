"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, CheckCircle2, Filter, RotateCcw, Search, SearchX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  summarizeOutstanding,
  type OutstandingInvoice,
} from "@/lib/mock/outstanding";
import { invoiceHref } from "@/lib/mock/invoice-lookup";
import { cn, formatCurrency, formatNumber } from "@/lib/utils";

type Props = {
  items: OutstandingInvoice[];
  showLocationColumn?: boolean;
  compact?: boolean;
};

const BUCKET_COLOR: Record<OutstandingInvoice["agingBucket"], string> = {
  "0-30": "hsl(142 71% 45%)",
  "31-60": "hsl(199 89% 48%)",
  "61-90": "hsl(38 92% 50%)",
  ">90": "hsl(0 84% 60%)",
};

const STATUS_META: Record<
  OutstandingInvoice["status"],
  { label: string; variant: "success" | "warning" | "danger" }
> = {
  onTime: { label: "On Time", variant: "success" },
  atRisk: { label: "At Risk", variant: "warning" },
  overdue: { label: "Overdue", variant: "danger" },
};

const BUCKET_ORDER: OutstandingInvoice["agingBucket"][] = ["0-30", "31-60", "61-90", ">90"];

export function OutstandingInvoiceTable({ items, showLocationColumn = true, compact = false }: Props) {
  const router = useRouter();
  const [bucketFilter, setBucketFilter] = useState<OutstandingInvoice["agingBucket"] | "all">("all");
  const [projectFilter, setProjectFilter] = useState<string | "all">("all");
  const [search, setSearch] = useState("");

  // Ignore row navigation when the click originated from an interactive
  // element (link/button), so those keep their own behavior.
  function navigateFromRow(e: React.MouseEvent, invoiceNumber: string) {
    if ((e.target as HTMLElement).closest("a,button")) return;
    router.push(invoiceHref(invoiceNumber));
  }

  const summary = useMemo(() => summarizeOutstanding(items), [items]);
  const projects = useMemo(() => Array.from(new Set(items.map((i) => i.projectCode))), [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      if (bucketFilter !== "all" && item.agingBucket !== bucketFilter) return false;
      if (projectFilter !== "all" && item.projectCode !== projectFilter) return false;
      if (q && !item.invoiceNumber.toLowerCase().includes(q) && !item.pic.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [items, bucketFilter, projectFilter, search]);

  const shown = compact ? filtered.slice(0, 8) : filtered;

  const hasActiveFilters =
    bucketFilter !== "all" || projectFilter !== "all" || search.trim().length > 0;

  function clearFilters() {
    setBucketFilter("all");
    setProjectFilter("all");
    setSearch("");
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-dashed py-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
          <CheckCircle2 className="h-6 w-6 text-emerald-500" />
        </div>
        <div>
          <div className="text-sm font-semibold">Tidak ada invoice outstanding</div>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Semua invoice pada scope & periode ini sudah settled. Coba ubah periode atau
            pilih site lain untuk melihat outstanding yang lebih lama.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <SummaryTile label="Total" value={formatCurrency(summary.totalAmount)} hint={`${summary.totalCount} invoice`} accent="bg-primary/10 text-primary" />
        {BUCKET_ORDER.map((b) => (
          <SummaryTile
            key={b}
            label={`Aging ${b}`}
            value={formatCurrency(summary.byBucket[b].amount)}
            hint={`${summary.byBucket[b].count} invoice`}
            accentColor={BUCKET_COLOR[b]}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-md border bg-card p-2">
        <span className="inline-flex items-center gap-1 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Filter className="h-3 w-3" />
          Bucket
        </span>
        <Chip label={`Semua · ${items.length}`} active={bucketFilter === "all"} onClick={() => setBucketFilter("all")} />
        {BUCKET_ORDER.map((b) => (
          <Chip
            key={b}
            label={`${b} · ${summary.byBucket[b].count}`}
            active={bucketFilter === b}
            color={BUCKET_COLOR[b]}
            onClick={() => setBucketFilter(b)}
          />
        ))}
        {projects.length > 1 && (
          <>
            <span className="ml-2 border-l pl-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Project
            </span>
            <Chip label="Semua" active={projectFilter === "all"} onClick={() => setProjectFilter("all")} />
            {projects.map((p) => (
              <Chip key={p} label={p} active={projectFilter === p} onClick={() => setProjectFilter(p)} />
            ))}
          </>
        )}
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
              {showLocationColumn && (
                <th className="px-3 py-2 text-left font-medium">Site</th>
              )}
              <th className="px-3 py-2 text-left font-medium">Stage</th>
              <th className="px-3 py-2 text-left font-medium">Status</th>
              <th className="px-3 py-2 text-left font-medium">Aging</th>
              <th className="px-3 py-2 text-left font-medium">Due</th>
              <th className="px-3 py-2 text-left font-medium">PIC</th>
              <th className="px-3 py-2 text-right font-medium">Nilai</th>
              <th className="px-3 py-2 text-right font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 && (
              <tr>
                <td colSpan={showLocationColumn ? 9 : 8} className="px-4 py-10">
                  <div className="flex flex-col items-center justify-center gap-2 text-center">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                      <SearchX className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="text-sm font-medium">Tidak ada invoice cocok filter</div>
                    <p className="max-w-xs text-xs text-muted-foreground">
                      {search.trim()
                        ? `Tidak ada hasil untuk "${search.trim()}".`
                        : "Kombinasi bucket/project yang dipilih tidak memiliki invoice."}
                    </p>
                    {hasActiveFilters && (
                      <Button size="sm" variant="outline" className="mt-1 h-7" onClick={clearFilters}>
                        <RotateCcw className="h-3 w-3" />
                        Reset filter
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            )}
            {shown.map((item) => {
              const status = STATUS_META[item.status];
              return (
                <tr
                  key={item.id}
                  onClick={(e) => navigateFromRow(e, item.invoiceNumber)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") router.push(invoiceHref(item.invoiceNumber));
                  }}
                  tabIndex={0}
                  role="link"
                  aria-label={`Buka detail ${item.invoiceNumber}`}
                  className="cursor-pointer border-b last:border-0 hover:bg-muted/30 focus:bg-muted/40 focus:outline-none"
                >
                  <td className="px-3 py-2">
                    <Link
                      href={invoiceHref(item.invoiceNumber)}
                      className="text-sm font-medium tabular-nums text-primary hover:underline"
                    >
                      {item.invoiceNumber}
                    </Link>
                  </td>
                  {showLocationColumn && (
                    <td className="px-3 py-2 text-muted-foreground">
                      <div className="text-sm">{item.locationName}</div>
                      <div className="text-[11px]">{item.projectCode}</div>
                    </td>
                  )}
                  <td className="px-3 py-2 text-muted-foreground">{item.stage}</td>
                  <td className="px-3 py-2">
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className="inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium text-white"
                      style={{ backgroundColor: BUCKET_COLOR[item.agingBucket] }}
                    >
                      {item.agingBucket}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{item.dueDate}</td>
                  <td className="px-3 py-2 text-muted-foreground">{item.pic}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium">
                    {formatCurrency(item.amount)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Link
                      href={invoiceHref(item.invoiceNumber)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                    >
                      Detail
                      <ArrowUpRight className="h-3 w-3" />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
          {shown.length > 0 && !compact && (
            <tfoot>
              <tr className="border-t bg-muted/30 text-sm font-medium">
                <td colSpan={showLocationColumn ? 7 : 6} className="px-3 py-2">
                  Total ({formatNumber(filtered.length)} invoice)
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatCurrency(filtered.reduce((s, r) => s + r.amount, 0))}
                </td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {compact && filtered.length > shown.length && (
        <div className="text-center text-[11px] text-muted-foreground">
          Menampilkan {shown.length} dari {filtered.length} · buka halaman Outstanding untuk daftar penuh.
        </div>
      )}
    </div>
  );
}

function Chip({
  label,
  active,
  color,
  onClick,
}: {
  label: string;
  active: boolean;
  color?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md border px-2 py-1 text-[11px] font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-input bg-background hover:bg-accent",
      )}
      style={active && color ? { backgroundColor: color, borderColor: color } : undefined}
    >
      {label}
    </button>
  );
}

function SummaryTile({
  label,
  value,
  hint,
  accent,
  accentColor,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: string;
  accentColor?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-md border p-3",
        accent && accent,
      )}
      style={accentColor ? { borderColor: accentColor } : undefined}
    >
      <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {accentColor && (
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: accentColor }}
          />
        )}
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}
