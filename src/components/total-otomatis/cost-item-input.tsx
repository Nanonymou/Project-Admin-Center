"use client";

import { useMemo, useState } from "react";
import { Calculator, Copy, Plus, Trash2, Wallet } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { usePersona } from "@/components/providers/persona-provider";
import { canAccessLocation } from "@/lib/personas";
import { formatCurrency, formatNumber, terbilang } from "@/lib/utils";
import { MOCK_WORKSPACES } from "@/lib/mock/workspaces";
import { getCostCategories } from "@/lib/mock/cost-config";

type CostItem = {
  id: string;
  categoryKey: string;
  label: string;
  qty: number;
  price: number;
};

let idSeq = 0;
function nextId(): string {
  idSeq += 1;
  return `item-${idSeq}`;
}

/**
 * Mock cost-item input page (Total Otomatis). An admin adds cost line items —
 * category, quantity, unit price — and the per-line and grand totals recompute
 * automatically as the values change. Categories are config-driven per project;
 * seeded with a few mock rows. No backend is required at this stage.
 */
export function CostItemInput() {
  const { persona } = usePersona();

  const workspaces = useMemo(
    () => MOCK_WORKSPACES.filter((w) => canAccessLocation(persona, w.locationId, w.projectCode)),
    [persona],
  );
  const [wsIndex, setWsIndex] = useState(0);
  const ws = workspaces[wsIndex] ?? workspaces[0];

  const categories = useMemo(
    () => (ws ? getCostCategories(ws.projectCode) : []),
    [ws],
  );

  const seededItems = useMemo<CostItem[]>(() => {
    return categories.slice(0, 3).map((c, i) => ({
      id: nextId(),
      categoryKey: c.key,
      label: c.label,
      qty: 1 + i,
      price: 500000 * (i + 1),
    }));
  }, [categories]);

  const [items, setItems] = useState<CostItem[]>([]);
  // Show seeded rows until the user starts editing (tracked by a dirty flag).
  const [dirty, setDirty] = useState(false);
  const rows = dirty ? items : seededItems;

  function mutate(next: CostItem[]) {
    setDirty(true);
    setItems(next);
  }

  const [pendingDelete, setPendingDelete] = useState<CostItem | null>(null);

  function addRow() {
    const first = categories[0];
    mutate([
      ...rows,
      { id: nextId(), categoryKey: first?.key ?? "", label: first?.label ?? "Item", qty: 1, price: 0 },
    ]);
  }

  function duplicateRow(id: string) {
    const src = rows.find((r) => r.id === id);
    if (!src) return;
    const idx = rows.findIndex((r) => r.id === id);
    const copy = { ...src, id: nextId() };
    const next = [...rows];
    next.splice(idx + 1, 0, copy);
    mutate(next);
  }

  function removeRow(id: string) {
    mutate(rows.filter((r) => r.id !== id));
    setPendingDelete(null);
  }

  function updateRow(id: string, patch: Partial<CostItem>) {
    mutate(
      rows.map((r) => {
        if (r.id !== id) return r;
        const merged = { ...r, ...patch };
        if (patch.categoryKey) {
          merged.label = categories.find((c) => c.key === patch.categoryKey)?.label ?? merged.label;
        }
        return merged;
      }),
    );
  }

  const lineTotal = (r: CostItem) => Math.max(0, r.qty) * Math.max(0, r.price);
  const grandTotal = rows.reduce((s, r) => s + lineTotal(r), 0);
  const totalQty = rows.reduce((s, r) => s + Math.max(0, r.qty), 0);

  if (!ws) {
    return (
      <div>
        <PageHeader title="Total Otomatis" description="Input item biaya dengan total otomatis." />
        <div className="p-6 text-sm text-muted-foreground">Tidak ada workspace dalam cakupan Anda.</div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Total Otomatis"
        description="Input item biaya — total per baris dan total keseluruhan dihitung otomatis."
        breadcrumbs={[{ label: "Operasional" }, { label: "Total Otomatis" }]}
      />

      <div className="space-y-6 p-4 md:p-6">
        <PersonaBanner persona={persona} scopeSummary={`${workspaces.length} workspace`} />

        <Card>
          <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-primary" />
                Item Biaya
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
                  setDirty(false);
                  setItems([]);
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
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2 text-left font-medium">Kategori</th>
                    <th className="px-3 py-2 text-right font-medium">Qty</th>
                    <th className="px-3 py-2 text-right font-medium">Harga Satuan</th>
                    <th className="px-3 py-2 text-right font-medium">Total</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                        Belum ada item. Tambahkan item biaya.
                      </td>
                    </tr>
                  )}
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-3 py-2">
                        <select
                          value={r.categoryKey}
                          onChange={(e) => updateRow(r.id, { categoryKey: e.target.value })}
                          className="h-8 w-full min-w-[10rem] rounded-md border bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                        >
                          {categories.map((c) => (
                            <option key={c.key} value={c.key}>
                              {c.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          min={0}
                          value={r.qty}
                          onChange={(e) => updateRow(r.id, { qty: Math.max(0, Number(e.target.value) || 0) })}
                          className="h-8 w-20 rounded-md border bg-background px-2 text-right text-sm tabular-nums outline-none focus:ring-2 focus:ring-ring"
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          min={0}
                          step={1000}
                          value={r.price}
                          onChange={(e) => updateRow(r.id, { price: Math.max(0, Number(e.target.value) || 0) })}
                          className="h-8 w-32 rounded-md border bg-background px-2 text-right text-sm tabular-nums outline-none focus:ring-2 focus:ring-ring"
                        />
                      </td>
                      <td className="px-3 py-2 text-right font-medium tabular-nums">
                        {formatCurrency(lineTotal(r))}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => duplicateRow(r.id)}
                            title="Duplikat item"
                          >
                            <Copy className="h-4 w-4 text-muted-foreground" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setPendingDelete(r)}
                            title="Hapus item"
                          >
                            <Trash2 className="h-4 w-4 text-rose-500" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t p-3">
              <Button size="sm" variant="outline" onClick={addRow} disabled={categories.length === 0}>
                <Plus className="h-4 w-4" />
                Tambah Item
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-4 w-4 text-primary" />
              Ringkasan
            </CardTitle>
            <CardDescription>
              {rows.length} item · {formatNumber(totalQty)} qty · dihitung otomatis.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-end gap-1">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Total Biaya
              </div>
              <div className="text-2xl font-bold tabular-nums text-primary md:text-3xl">
                {formatCurrency(grandTotal)}
              </div>
              <div className="max-w-md text-right text-[11px] capitalize italic text-muted-foreground">
                {terbilang(grandTotal)}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Delete confirmation */}
      <Dialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title="Hapus item?"
        description={pendingDelete ? pendingDelete.label : undefined}
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setPendingDelete(null)}>
              Batal
            </Button>
            <Button
              size="sm"
              className="bg-rose-600 text-white hover:bg-rose-700"
              onClick={() => pendingDelete && removeRow(pendingDelete.id)}
            >
              <Trash2 className="h-4 w-4" />
              Hapus
            </Button>
          </div>
        }
      >
        <p className="text-sm text-muted-foreground">
          Item <b>{pendingDelete?.label}</b> akan dihapus dari perhitungan. Tindakan ini tidak dapat
          dibatalkan.
        </p>
      </Dialog>
    </div>
  );
}
