"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Info, Save, ShoppingCart } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { usePersona } from "@/components/providers/persona-provider";
import { useActiveSite } from "@/components/providers/active-site-provider";
import {
  getServiceCategories,
  lineTotal,
  sumSalesEntry,
  validateSalesEntry,
  type SalesEntryInput,
} from "@/lib/mock/service-config";
import { computeTax } from "@/lib/finance";
import { cn, formatCurrency } from "@/lib/utils";

type SubmittedEntry = {
  id: string;
  date: string;
  total: number;
  tax: number;
  lines: { label: string; qty: number; price: number; total: number }[];
  status: "draft" | "submitted";
};

export function DailySalesEngine() {
  const { persona } = usePersona();
  const { activeWorkspace } = useActiveSite();
  const categories = useMemo(
    () => getServiceCategories(activeWorkspace.projectCode),
    [activeWorkspace.projectCode],
  );

  const today = new Date().toISOString().slice(0, 10);
  const yesterday = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  }, []);

  const [date, setDate] = useState(today);
  const [values, setValues] = useState<SalesEntryInput>(() =>
    Object.fromEntries(categories.map((c) => [c.key, { qty: 0, price: c.defaultPrice }])),
  );
  const [touched, setTouched] = useState(false);
  const [entries, setEntries] = useState<SubmittedEntry[]>([]);

  const canCreate =
    persona.role === "site_admin" || persona.role === "super_admin" || persona.role === "leader_admin";
  const dateAllowed = date === today || date === yesterday;

  const errors = useMemo(() => validateSalesEntry(categories, values), [categories, values]);
  const subtotal = useMemo(() => sumSalesEntry(categories, values), [categories, values]);
  const tax = useMemo(
    () => computeTax(subtotal, activeWorkspace.projectCode),
    [subtotal, activeWorkspace.projectCode],
  );
  const formError = errors.find((e) => e.key === "_form");

  function setLine(key: string, field: "qty" | "price", raw: string) {
    const num = raw === "" ? 0 : Number(raw);
    setValues((prev) => ({ ...prev, [key]: { ...prev[key], [field]: num } }));
  }

  function handleSubmit(status: "draft" | "submitted") {
    setTouched(true);
    if (!dateAllowed || errors.length > 0) return;
    setEntries((prev) => [
      {
        id: `${date}-${Date.now()}`,
        date,
        total: subtotal,
        tax,
        status,
        lines: categories
          .filter((c) => (values[c.key]?.qty || 0) > 0)
          .map((c) => ({
            label: c.label,
            qty: values[c.key].qty,
            price: values[c.key].price,
            total: lineTotal(values[c.key]),
          })),
      },
      ...prev,
    ]);
    setValues(Object.fromEntries(categories.map((c) => [c.key, { qty: 0, price: c.defaultPrice }])));
    setTouched(false);
  }

  return (
    <div>
      <PageHeader
        title="Submit Daily Sales"
        description={`Input penjualan harian untuk ${activeWorkspace.projectName} · ${activeWorkspace.locationName}.`}
        breadcrumbs={[{ label: "Operasional" }, { label: "Daily Sales" }]}
      />

      <div className="space-y-6 p-4 md:p-6">
        <PersonaBanner
          persona={persona}
          scopeSummary={`${activeWorkspace.projectCode} · ${activeWorkspace.locationName}`}
        />

        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Kategori & harga default mengikuti konfigurasi project{" "}
            <b>{activeWorkspace.projectCode}</b>. Aturan Cut-Off <b>H+1</b> — input hanya untuk hari
            ini atau kemarin. Sales = Qty × Harga.
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-primary" />
                Form Daily Sales
              </CardTitle>
              <CardDescription>Isi Qty & Harga per kategori layanan.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="max-w-xs">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Tanggal</label>
                <Input type="date" value={date} max={today} min={yesterday} onChange={(e) => setDate(e.target.value)} />
                {touched && !dateAllowed && (
                  <p className="mt-1 text-[11px] text-rose-600">Tanggal di luar aturan H+1.</p>
                )}
              </div>

              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                      <th className="px-3 py-2 text-left font-medium">Kategori</th>
                      <th className="px-3 py-2 text-right font-medium">Qty</th>
                      <th className="px-3 py-2 text-right font-medium">Harga</th>
                      <th className="px-3 py-2 text-right font-medium">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map((cat) => {
                      const line = values[cat.key];
                      const err = errors.find((e) => e.key === cat.key);
                      return (
                        <tr key={cat.key} className="border-b last:border-0">
                          <td className="px-3 py-2">
                            <div className="text-sm font-medium">{cat.label}</div>
                            <div className="text-[10px] text-muted-foreground">per {cat.unit}</div>
                          </td>
                          <td className="px-3 py-2">
                            <Input
                              type="number"
                              min={0}
                              value={line?.qty ?? 0}
                              onChange={(e) => setLine(cat.key, "qty", e.target.value)}
                              className={cn("h-8 w-24 text-right", touched && err && "border-rose-400")}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Input
                              type="number"
                              min={0}
                              value={line?.price ?? 0}
                              onChange={(e) => setLine(cat.key, "price", e.target.value)}
                              className="h-8 w-28 text-right"
                            />
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums font-medium">
                            {formatCurrency(lineTotal(line))}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {touched && formError && (
                <div className="flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {formError.message}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3 text-sm">
                <div className="space-y-0.5">
                  <div>
                    <span className="text-muted-foreground">Subtotal: </span>
                    <span className="font-semibold tabular-nums">{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Pajak ({activeWorkspace.projectCode}): {formatCurrency(tax)} · Net Invoice{" "}
                    {formatCurrency(subtotal + tax)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={!canCreate} onClick={() => handleSubmit("draft")}>
                    Simpan Draft
                  </Button>
                  <Button size="sm" disabled={!canCreate} onClick={() => handleSubmit("submitted")}>
                    <Save className="h-4 w-4" />
                    Submit
                  </Button>
                </div>
              </div>
              {!canCreate && (
                <p className="text-[11px] text-muted-foreground">
                  Peran {persona.roleLabel} tidak memiliki izin input Daily Sales.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Entri Terbaru</CardTitle>
              <CardDescription>Tersimpan di sesi ini (mock).</CardDescription>
            </CardHeader>
            <CardContent>
              {entries.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  Belum ada entri Daily Sales.
                </div>
              ) : (
                <ul className="space-y-2">
                  {entries.map((entry) => (
                    <li key={entry.id} className="rounded-md border p-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium tabular-nums">{entry.date}</span>
                        <Badge variant={entry.status === "submitted" ? "success" : "muted"}>
                          {entry.status === "submitted" ? "Submitted" : "Draft"}
                        </Badge>
                      </div>
                      <div className="mt-1 text-sm font-semibold tabular-nums">
                        {formatCurrency(entry.total)}
                      </div>
                      <ul className="mt-1 space-y-0.5 text-[11px] text-muted-foreground">
                        {entry.lines.map((l) => (
                          <li key={l.label} className="flex justify-between">
                            <span>{l.label} × {l.qty}</span>
                            <span className="tabular-nums">{formatCurrency(l.total)}</span>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
