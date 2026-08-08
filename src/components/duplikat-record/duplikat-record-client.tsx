"use client";

import { useMemo, useState } from "react";
import { Copy, ShoppingCart, MapPin } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePersona } from "@/components/providers/persona-provider";
import { canAccessLocation } from "@/lib/personas";
import { formatCurrency, formatDate } from "@/lib/utils";
import { MOCK_WORKSPACES } from "@/lib/mock/workspaces";
import { getPricedCategories } from "@/lib/mock/pricing-config";
import { getAreasFor } from "@/lib/mock/area-config";

type SalesRecord = {
  id: string;
  date: string;
  areaName: string;
  categoryLabel: string;
  qty: number;
  price: number;
  duplicate?: boolean;
};

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

/**
 * Daily Sales page with a "Duplikat" (duplicate record) action. Each existing
 * entry can be cloned into a new draft for a fast repeat input, after which the
 * admin can adjust quantities. Config-driven per project/location and
 * persona-scoped; seeded from mock data with no backend required.
 */
export function DuplikatRecordClient() {
  const { persona } = usePersona();
  const canInput =
    persona.role === "site_admin" || persona.role === "leader_admin" || persona.role === "super_admin";

  const workspaces = useMemo(
    () => MOCK_WORKSPACES.filter((w) => canAccessLocation(persona, w.locationId, w.projectCode)),
    [persona],
  );
  const [wsIndex, setWsIndex] = useState(0);
  const ws = workspaces[wsIndex] ?? workspaces[0];

  const seeded = useMemo<SalesRecord[]>(() => {
    if (!ws) return [];
    const cats = getPricedCategories(ws.projectCode, ws.locationId).filter((c) => !c.deduction);
    const areas = getAreasFor(ws.locationId, ws.locationName);
    return cats.slice(0, 5).map((c, i) => ({
      id: `seed-${ws.locationId}-${i}`,
      date: isoDaysAgo(i % 3),
      areaName: areas[i % areas.length]?.name ?? "Area",
      categoryLabel: c.label,
      qty: 40 + ((i * 19) % 90),
      price: c.price,
    }));
  }, [ws]);

  const [added, setAdded] = useState<SalesRecord[]>([]);
  const records = useMemo(() => [...added, ...seeded], [added, seeded]);

  let dupSeq = 0;
  function duplicate(rec: SalesRecord) {
    dupSeq += 1;
    const copy: SalesRecord = {
      ...rec,
      id: `dup-${Date.now()}-${dupSeq}`,
      date: isoDaysAgo(0),
      duplicate: true,
    };
    setAdded((prev) => [copy, ...prev]);
  }

  const lineTotal = (r: SalesRecord) => r.qty * r.price;
  const grandTotal = records.reduce((s, r) => s + lineTotal(r), 0);

  if (!ws) {
    return (
      <div>
        <PageHeader title="Duplikat Record" description="Daily Sales dengan aksi duplikat entri." />
        <div className="p-6 text-sm text-muted-foreground">Tidak ada workspace dalam cakupan Anda.</div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Duplikat Record"
        description="Daily Sales — duplikat entri yang sudah ada untuk input berulang lebih cepat."
        breadcrumbs={[{ label: "Operasional" }, { label: "Duplikat Record" }]}
      />

      <div className="space-y-6 p-4 md:p-6">
        <PersonaBanner persona={persona} scopeSummary={`${workspaces.length} workspace`} />

        <div className="flex flex-wrap items-center gap-3">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <label className="text-xs text-muted-foreground">Workspace</label>
          <select
            value={wsIndex}
            onChange={(e) => {
              setWsIndex(Number(e.target.value));
              setAdded([]);
            }}
            className="h-8 rounded-md border bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-ring"
          >
            {workspaces.map((w, i) => (
              <option key={w.locationId} value={i}>
                {w.projectCode} — {w.locationName}
              </option>
            ))}
          </select>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-primary" />
              Entri Daily Sales — {ws.locationName}
            </CardTitle>
            <CardDescription>
              {records.length} entri · total {formatCurrency(grandTotal)}. Gunakan Duplikat untuk menyalin
              entri menjadi draft baru.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
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
                    <th className="px-3 py-2 text-right font-medium">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => (
                    <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-3 py-2 whitespace-nowrap">
                        {formatDate(r.date)}
                        {r.duplicate && (
                          <Badge variant="info" className="ml-2">
                            Duplikat
                          </Badge>
                        )}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{r.areaName}</td>
                      <td className="px-3 py-2">{r.categoryLabel}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.qty}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {formatCurrency(r.price)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium">
                        {formatCurrency(lineTotal(r))}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!canInput}
                          onClick={() => duplicate(r)}
                        >
                          <Copy className="h-4 w-4" />
                          Duplikat
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
    </div>
  );
}
