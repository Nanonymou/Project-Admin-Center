"use client";

import { useMemo, useState } from "react";
import { ShoppingCart, History, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { usePersona } from "@/components/providers/persona-provider";
import { canAccessLocation } from "@/lib/personas";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { buildSalesTransactions, type SalesTransaction } from "@/lib/mock/sales-change-log";

/**
 * Riwayat Perubahan Penjualan — sales transactions list with a per-row "Riwayat"
 * button that opens the transaction's change history (create/update trail).
 * Config-driven per project/location and persona-scoped; seeded from mock data
 * with no backend required.
 */
export function RiwayatPenjualanClient() {
  const { persona } = usePersona();

  const transactions = useMemo(
    () =>
      buildSalesTransactions().filter((t) => canAccessLocation(persona, t.locationId, t.projectCode)),
    [persona],
  );

  const [locationFilter, setLocationFilter] = useState<string>("all");
  const locations = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of transactions) map.set(t.locationId, `${t.locationName} · ${t.projectCode}`);
    return Array.from(map, ([id, label]) => ({ id, label }));
  }, [transactions]);

  const visible = transactions.filter(
    (t) => locationFilter === "all" || t.locationId === locationFilter,
  );

  const [historyOf, setHistoryOf] = useState<SalesTransaction | null>(null);

  return (
    <div>
      <PageHeader
        title="Riwayat Perubahan Penjualan"
        description="Daftar transaksi penjualan dengan jejak perubahan per transaksi."
        breadcrumbs={[{ label: "Operasional" }, { label: "Riwayat Perubahan Penjualan" }]}
      />

      <div className="space-y-6 p-4 md:p-6">
        <PersonaBanner persona={persona} scopeSummary={`${locations.length} site`} />

        <Card>
          <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-primary" />
                Transaksi Penjualan
              </CardTitle>
              <CardDescription>{visible.length} transaksi pada cakupan Anda.</CardDescription>
            </div>
            <select
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="h-8 rounded-md border bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="all">Semua Site</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </select>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2 text-left font-medium">Tanggal</th>
                    <th className="px-3 py-2 text-left font-medium">Site</th>
                    <th className="px-3 py-2 text-left font-medium">Kategori</th>
                    <th className="px-3 py-2 text-right font-medium">Qty</th>
                    <th className="px-3 py-2 text-right font-medium">Total</th>
                    <th className="px-3 py-2 text-right font-medium">Riwayat</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((t) => (
                    <tr key={t.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-3 py-2 whitespace-nowrap">{formatDate(t.trxDate)}</td>
                      <td className="px-3 py-2">
                        <span className="font-medium">{t.locationName}</span>
                        <span className="ml-1 text-[11px] text-muted-foreground">{t.projectCode}</span>
                      </td>
                      <td className="px-3 py-2">{t.categoryLabel}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{t.qty}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium">
                        {formatCurrency(t.total)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button size="sm" variant="outline" onClick={() => setHistoryOf(t)}>
                          <History className="h-4 w-4" />
                          Riwayat
                          {t.editedCount > 0 && (
                            <Badge variant="info" className="ml-1">
                              {t.editedCount}
                            </Badge>
                          )}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Per-transaction change history */}
      <Dialog
        open={historyOf !== null}
        onClose={() => setHistoryOf(null)}
        title="Riwayat Perubahan Transaksi"
        description={
          historyOf
            ? `${historyOf.categoryLabel} · ${historyOf.locationName} · ${formatDate(historyOf.trxDate)}`
            : undefined
        }
        className="max-w-lg"
      >
        {historyOf && (
          <ol className="space-y-3">
            {historyOf.history.map((h, i) => (
              <li key={i} className="flex items-start gap-3">
                <Badge variant={h.action === "create" ? "success" : "info"} className="mt-0.5 shrink-0">
                  {h.action === "create" ? "Dibuat" : "Diubah"}
                </Badge>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium capitalize">{h.field}</span>
                    {h.action === "update" && (
                      <span className="flex items-center gap-1.5 text-xs tabular-nums">
                        <span className="text-muted-foreground line-through">{h.before}</span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        <span className="font-medium">{h.after}</span>
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {h.editor} · {formatDateTime(h.at)}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </Dialog>
    </div>
  );
}
