"use client";

import { useMemo, useState } from "react";
import { Calculator, Receipt } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePersona } from "@/components/providers/persona-provider";
import { canAccessLocation } from "@/lib/personas";
import { cn, formatCurrency, formatNumber } from "@/lib/utils";
import { calculateTransaction } from "@/lib/finance";
import { MOCK_WORKSPACES } from "@/lib/mock/workspaces";
import { getPricedCategories } from "@/lib/mock/pricing-config";
import { getTaxConfig } from "@/lib/mock/tax-config";

/**
 * Transaction input form with automatic calculation (Perhitungan Otomatis).
 * Config-driven: line items, prices, and the tax rate are read per project /
 * location from the shared pricing & tax config. As the user edits quantities
 * the subtotal, tax (PPN/PB1 by project), and grand total recompute live.
 * Seeded with mock quantities; no backend is required at this stage.
 */
export function PerhitunganForm() {
  const { persona } = usePersona();

  const workspaces = useMemo(
    () => MOCK_WORKSPACES.filter((w) => canAccessLocation(persona, w.locationId, w.projectCode)),
    [persona],
  );

  const [wsIndex, setWsIndex] = useState(0);
  const ws = workspaces[wsIndex] ?? workspaces[0];

  const categories = useMemo(
    () => (ws ? getPricedCategories(ws.projectCode, ws.locationId) : []),
    [ws],
  );
  const tax = useMemo(() => (ws ? getTaxConfig(ws.projectCode) : null), [ws]);

  // Quantities keyed by category — seeded with deterministic mock values.
  const [qty, setQty] = useState<Record<string, number>>({});
  const seededQty = useMemo(() => {
    const out: Record<string, number> = {};
    categories.forEach((c, i) => {
      out[c.key] = c.deduction ? 0 : 20 + ((i * 17) % 90);
    });
    return out;
  }, [categories]);

  function qtyOf(key: string): number {
    return qty[key] ?? seededQty[key] ?? 0;
  }

  // Automatic calculation — shared, config-aware engine (subtotal → tax → total).
  const calc = calculateTransaction(
    categories.map((c) => ({
      key: c.key,
      label: c.label,
      unit: c.unit,
      price: c.price,
      qty: qtyOf(c.key),
      deduction: c.deduction,
    })),
    ws?.projectCode ?? "",
  );
  const { lines, subtotal, taxAmount, total, taxRate } = calc;

  // Breakdown for the polished result panel.
  const grossTotal = lines.reduce((s, l) => s + (l.amount > 0 ? l.amount : 0), 0);
  const deductionTotal = lines.reduce((s, l) => s + (l.amount < 0 ? -l.amount : 0), 0);
  const activeLineCount = lines.filter((l) => l.qty > 0).length;
  const totalQty = lines.reduce((s, l) => s + l.qty, 0);

  if (!ws) {
    return (
      <div>
        <PageHeader
          title="Perhitungan Otomatis"
          description="Form input transaksi dengan kalkulasi pajak & total otomatis."
        />
        <div className="p-6 text-sm text-muted-foreground">Tidak ada workspace dalam cakupan Anda.</div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Perhitungan Otomatis"
        description="Form input transaksi dengan kalkulasi subtotal, pajak, dan total secara otomatis."
        breadcrumbs={[{ label: "Operasional" }, { label: "Perhitungan Otomatis" }]}
      />

      <div className="space-y-6 p-4 md:p-6">
        <PersonaBanner persona={persona} scopeSummary={`${workspaces.length} workspace`} />

        <Card>
          <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-4 w-4 text-primary" />
                Detail Transaksi
              </CardTitle>
              <CardDescription>
                {ws.projectName} · {ws.locationName}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground">Workspace</label>
              <select
                value={wsIndex}
                onChange={(e) => {
                  setWsIndex(Number(e.target.value));
                  setQty({});
                }}
                className="h-8 rounded-md border bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-ring"
              >
                {workspaces.map((w, i) => (
                  <option key={w.locationId} value={i}>
                    {w.projectCode} — {w.locationName}
                  </option>
                ))}
              </select>
              {tax && <Badge variant="info">{tax.label}</Badge>}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2 text-left font-medium">Kategori</th>
                    <th className="px-3 py-2 text-right font-medium">Harga</th>
                    <th className="px-3 py-2 text-right font-medium">Qty</th>
                    <th className="px-3 py-2 text-right font-medium">Jumlah</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => (
                    <tr key={l.key} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-3 py-2">
                        <span className="font-medium">{l.label}</span>
                        {l.deduction && (
                          <Badge variant="warning" className="ml-2">
                            Pengurang
                          </Badge>
                        )}
                        <div className="text-[11px] text-muted-foreground">per {l.unit}</div>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {formatCurrency(l.price)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          min={0}
                          value={qtyOf(l.key)}
                          onChange={(e) =>
                            setQty((prev) => ({ ...prev, [l.key]: Math.max(0, Number(e.target.value) || 0) }))
                          }
                          className="h-8 w-20 rounded-md border bg-background px-2 text-right text-sm tabular-nums outline-none focus:ring-2 focus:ring-ring"
                        />
                      </td>
                      <td
                        className={cn(
                          "px-3 py-2 text-right font-medium tabular-nums",
                          l.amount < 0 && "text-rose-600",
                        )}
                      >
                        {formatCurrency(l.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Auto-calculation summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-4 w-4 text-primary" />
              Ringkasan Perhitungan
            </CardTitle>
            <CardDescription>
              {activeLineCount} kategori aktif · {formatNumber(totalQty)} qty · dihitung otomatis.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-5 md:items-stretch">
              {/* Breakdown */}
              <dl className="space-y-2 text-sm md:col-span-3">
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">Bruto (sebelum pengurang)</dt>
                  <dd className="font-medium tabular-nums">{formatCurrency(grossTotal)}</dd>
                </div>
                {deductionTotal > 0 && (
                  <div className="flex items-center justify-between">
                    <dt className="text-muted-foreground">Pengurang</dt>
                    <dd className="font-medium tabular-nums text-rose-600">
                      −{formatCurrency(deductionTotal)}
                    </dd>
                  </div>
                )}
                <div className="flex items-center justify-between border-t pt-2">
                  <dt className="text-muted-foreground">Subtotal</dt>
                  <dd className="font-medium tabular-nums">{formatCurrency(subtotal)}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="flex items-center gap-2 text-muted-foreground">
                    {tax ? tax.label : "Pajak"}
                    <Badge variant="info">{(taxRate * 100).toFixed(taxRate * 100 % 1 === 0 ? 0 : 1)}%</Badge>
                  </dt>
                  <dd className="font-medium tabular-nums">{formatCurrency(taxAmount)}</dd>
                </div>
              </dl>

              {/* Prominent total */}
              <div className="flex flex-col justify-center rounded-lg border bg-primary/5 p-4 text-center md:col-span-2">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Total Tagihan
                </div>
                <div className="mt-1 text-2xl font-bold tabular-nums text-primary md:text-3xl">
                  {formatCurrency(total)}
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  Termasuk {tax ? tax.label : "pajak"} {formatCurrency(taxAmount)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
