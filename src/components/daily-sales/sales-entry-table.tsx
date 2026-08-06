"use client";

import { useMemo, useState } from "react";
import { CLOSING_STATE_META } from "@/lib/mock/closing-status";
import type { SalesHistoryEntry } from "@/lib/mock/sales-history";
import { Badge } from "@/components/ui/badge";
import { cn, formatCurrency } from "@/lib/utils";

/**
 * Sales entries grouped/collapsible by site. Shows recent Daily Sales
 * submissions per location with subtotal/tax/net and closing state.
 */
export function SalesEntryTable({ entries }: { entries: SalesHistoryEntry[] }) {
  const grouped = useMemo(() => {
    const map = new Map<string, SalesHistoryEntry[]>();
    for (const e of entries) {
      map.set(e.locationId, [...(map.get(e.locationId) ?? []), e]);
    }
    return Array.from(map.entries()).map(([locationId, rows]) => ({
      locationId,
      locationName: rows[0].locationName,
      projectCode: rows[0].projectCode,
      rows,
      total: rows.reduce((s, r) => s + r.netInvoice, 0),
    }));
  }, [entries]);

  const [open, setOpen] = useState<string | null>(grouped[0]?.locationId ?? null);

  if (grouped.length === 0) {
    return (
      <div className="rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">
        Tidak ada entri penjualan.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {grouped.map((g) => {
        const isOpen = open === g.locationId;
        return (
          <div key={g.locationId} className="overflow-hidden rounded-md border">
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : g.locationId)}
              className="flex w-full items-center justify-between gap-2 bg-muted/30 px-3 py-2 text-left hover:bg-muted/50"
            >
              <span className="text-sm font-medium">
                {g.locationName}
                <span className="ml-2 text-[11px] text-muted-foreground">{g.projectCode}</span>
              </span>
              <span className="flex items-center gap-3 text-[11px] text-muted-foreground">
                <span>{g.rows.length} entri</span>
                <span className="font-semibold text-foreground tabular-nums">
                  {formatCurrency(g.total)}
                </span>
                <span>{isOpen ? "▲" : "▼"}</span>
              </span>
            </button>
            {isOpen && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-y bg-background text-[11px] uppercase tracking-wide text-muted-foreground">
                      <th className="px-3 py-2 text-left font-medium">Tanggal</th>
                      <th className="px-3 py-2 text-left font-medium">Kategori Top</th>
                      <th className="px-3 py-2 text-right font-medium">Lines</th>
                      <th className="px-3 py-2 text-right font-medium">Subtotal</th>
                      <th className="px-3 py-2 text-right font-medium">Net Invoice</th>
                      <th className="px-3 py-2 text-left font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.rows.slice(0, 12).map((r) => (
                      <tr key={r.id} className="border-b last:border-0 hover:bg-muted/20">
                        <td className="px-3 py-2 tabular-nums">{r.dateLabel}</td>
                        <td className="px-3 py-2 text-muted-foreground">{r.topCategory}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{r.lineCount}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(r.subtotal)}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-medium">
                          {formatCurrency(r.netInvoice)}
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant={CLOSING_STATE_META[r.state].variant}>
                            {CLOSING_STATE_META[r.state].label}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {g.rows.length > 12 && (
                  <div className={cn("px-3 py-2 text-[11px] text-muted-foreground")}>
                    Menampilkan 12 dari {g.rows.length} entri.
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
