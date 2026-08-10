"use client";

import { useMemo, useState } from "react";
import { Download, ShoppingCart, MapPin, FileJson } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { usePersona } from "@/components/providers/persona-provider";
import { canAccessLocation } from "@/lib/personas";
import { formatCurrency } from "@/lib/utils";
import { toCsv, downloadTextFile } from "@/lib/csv";
import { MOCK_WORKSPACES } from "@/lib/mock/workspaces";
import { getPricedCategories } from "@/lib/mock/pricing-config";
import { getAreasFor } from "@/lib/mock/area-config";

type SalesRow = {
  trxDate: string;
  area: string;
  categoryKey: string;
  categoryLabel: string;
  qty: number;
  price: number;
};

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

const EXPORT_HEADER = ["trxDate", "area", "categoryKey", "categoryLabel", "qty", "price", "total"];

/**
 * Daily Sales page with an Excel/CSV export button. Assembles config-driven
 * Daily Sales rows for the selected workspace and lets the admin export the
 * filtered data to CSV (Excel-compatible) or JSON. Persona-scoped; seeded from
 * mock data with no backend required.
 */
export function EksporExcelClient() {
  const { persona } = usePersona();
  const canExport = persona.capabilities.canExport;

  const workspaces = useMemo(
    () => MOCK_WORKSPACES.filter((w) => canAccessLocation(persona, w.locationId, w.projectCode)),
    [persona],
  );
  const [wsIndex, setWsIndex] = useState(0);
  const ws = workspaces[wsIndex] ?? workspaces[0];

  const rows = useMemo<SalesRow[]>(() => {
    if (!ws) return [];
    const cats = getPricedCategories(ws.projectCode, ws.locationId).filter((c) => !c.deduction);
    const areas = getAreasFor(ws.locationId, ws.locationName);
    const out: SalesRow[] = [];
    for (let d = 0; d < 3; d++) {
      cats.slice(0, 4).forEach((c, i) => {
        out.push({
          trxDate: isoDaysAgo(d),
          area: areas[i % areas.length]?.name ?? "Area",
          categoryKey: c.key,
          categoryLabel: c.label,
          qty: 30 + ((d * 7 + i * 13) % 100),
          price: c.price,
        });
      });
    }
    return out;
  }, [ws]);

  const grandTotal = rows.reduce((s, r) => s + r.qty * r.price, 0);

  function exportCsv() {
    if (!ws) return;
    const data: (string | number)[][] = rows.map((r) => [
      r.trxDate,
      r.area,
      r.categoryKey,
      r.categoryLabel,
      r.qty,
      r.price,
      r.qty * r.price,
    ]);
    downloadTextFile(
      `daily-sales-${ws.projectCode}-${ws.locationId}.csv`,
      toCsv([EXPORT_HEADER, ...data]),
    );
  }

  function exportJson() {
    if (!ws) return;
    const objects = rows.map((r) => ({ ...r, total: r.qty * r.price, project: ws.projectCode }));
    downloadTextFile(
      `daily-sales-${ws.projectCode}-${ws.locationId}.json`,
      JSON.stringify(objects, null, 2),
      "application/json;charset=utf-8",
    );
  }

  return (
    <div>
      <PageHeader
        title="Ekspor Excel — Daily Sales"
        description="Ekspor data Daily Sales per site ke format Excel (CSV) atau JSON."
        breadcrumbs={[{ label: "Operasional" }, { label: "Ekspor Excel" }]}
      />

      <div className="space-y-6 p-4 md:p-6">
        <PersonaBanner persona={persona} scopeSummary={canExport ? "Dapat mengekspor" : "Tanpa hak ekspor"} />

        <div className="flex flex-wrap items-center gap-3">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <label className="text-xs text-muted-foreground">Workspace</label>
          <select
            value={wsIndex}
            onChange={(e) => setWsIndex(Number(e.target.value))}
            className="h-8 rounded-md border bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-ring"
          >
            {workspaces.map((w, i) => (
              <option key={w.locationId} value={i}>
                {w.projectCode} — {w.locationName}
              </option>
            ))}
          </select>
          <div className="ml-auto flex items-center gap-2">
            <Button size="sm" disabled={!canExport || rows.length === 0} onClick={exportCsv}>
              <Download className="h-4 w-4" />
              Ekspor CSV
            </Button>
            <Button size="sm" variant="outline" disabled={!canExport || rows.length === 0} onClick={exportJson}>
              <FileJson className="h-4 w-4" />
              JSON
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-primary" />
              Data Daily Sales — {ws?.locationName ?? "—"}
            </CardTitle>
            <CardDescription>
              {rows.length} baris · total {formatCurrency(grandTotal)}.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {rows.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">Tidak ada data.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                      <th className="px-3 py-2 text-left font-medium">Tanggal</th>
                      <th className="px-3 py-2 text-left font-medium">Area</th>
                      <th className="px-3 py-2 text-left font-medium">Kategori</th>
                      <th className="px-3 py-2 text-right font-medium">Qty</th>
                      <th className="px-3 py-2 text-right font-medium">Harga</th>
                      <th className="px-3 py-2 text-right font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-3 py-2 whitespace-nowrap">{r.trxDate}</td>
                        <td className="px-3 py-2 text-muted-foreground">{r.area}</td>
                        <td className="px-3 py-2">{r.categoryLabel}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{r.qty}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                          {formatCurrency(r.price)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums font-medium">
                          {formatCurrency(r.qty * r.price)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
