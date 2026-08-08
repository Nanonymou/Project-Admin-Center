"use client";

import { useMemo, useState } from "react";
import { CopyPlus, ShoppingCart, CalendarDays, Info } from "lucide-react";
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

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

/**
 * Daily Sales input with a "Salin Data Kemarin" (copy yesterday) action. The
 * previous day's entry is seeded from config-driven priced categories; one click
 * copies its quantities into today's editable form, after which totals recompute
 * live. Config-driven and persona-scoped; no backend required at this stage.
 */
export function SalinDataKemarinClient() {
  const { persona } = usePersona();
  const canInput =
    persona.role === "site_admin" || persona.role === "leader_admin" || persona.role === "super_admin";

  const workspaces = useMemo(
    () => MOCK_WORKSPACES.filter((w) => canAccessLocation(persona, w.locationId, w.projectCode)),
    [persona],
  );
  const [wsIndex, setWsIndex] = useState(0);
  const ws = workspaces[wsIndex] ?? workspaces[0];

  const today = isoDaysAgo(0);
  const yesterday = isoDaysAgo(1);

  const categories = useMemo(
    () => (ws ? getPricedCategories(ws.projectCode, ws.locationId) : []),
    [ws],
  );

  // Yesterday's entry — deterministic mock quantities per category.
  const yesterdayQty = useMemo(() => {
    const out: Record<string, number> = {};
    categories.forEach((c, i) => {
      out[c.key] = c.deduction ? 0 : 30 + ((i * 23) % 110);
    });
    return out;
  }, [categories]);

  // Today's editable quantities — empty until the admin types or copies.
  const [todayQty, setTodayQty] = useState<Record<string, number>>({});
  const [copied, setCopied] = useState(false);

  function copyYesterday() {
    setTodayQty({ ...yesterdayQty });
    setCopied(true);
  }

  function reset() {
    setTodayQty({});
    setCopied(false);
  }

  const yesterdayTotal = categories.reduce(
    (s, c) => s + (yesterdayQty[c.key] ?? 0) * c.price * (c.deduction ? -1 : 1),
    0,
  );
  const todayTotal = categories.reduce(
    (s, c) => s + (todayQty[c.key] ?? 0) * c.price * (c.deduction ? -1 : 1),
    0,
  );

  if (!ws) {
    return (
      <div>
        <PageHeader title="Salin Data Kemarin" description="Input Daily Sales dengan salin data hari sebelumnya." />
        <div className="p-6 text-sm text-muted-foreground">Tidak ada workspace dalam cakupan Anda.</div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Salin Data Kemarin"
        description="Input Daily Sales lebih cepat — salin entri kemarin lalu sesuaikan seperlunya."
        breadcrumbs={[{ label: "Operasional" }, { label: "Salin Data Kemarin" }]}
      />

      <div className="space-y-6 p-4 md:p-6">
        <PersonaBanner persona={persona} scopeSummary={`${workspaces.length} workspace`} />

        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs text-muted-foreground">Workspace</label>
          <select
            value={wsIndex}
            onChange={(e) => {
              setWsIndex(Number(e.target.value));
              reset();
            }}
            className="h-8 rounded-md border bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-ring"
          >
            {workspaces.map((w, i) => (
              <option key={w.locationId} value={i}>
                {w.projectCode} — {w.locationName}
              </option>
            ))}
          </select>
          <Button size="sm" disabled={!canInput} onClick={copyYesterday}>
            <CopyPlus className="h-4 w-4" />
            Salin Data Kemarin
          </Button>
          {copied && (
            <Button size="sm" variant="outline" onClick={reset}>
              Reset
            </Button>
          )}
        </div>

        <div className="flex items-start gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Tombol <b>Salin Data Kemarin</b> menyalin qty entri {formatDate(yesterday)} ke form hari ini
            ({formatDate(today)}). Anda tetap dapat menyesuaikan angka sebelum menyimpan.
          </span>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Yesterday (read-only) */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                Data Kemarin
              </CardTitle>
              <CardDescription>{formatDate(yesterday)} · hanya-baca</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                      <th className="px-3 py-2 text-left font-medium">Kategori</th>
                      <th className="px-3 py-2 text-right font-medium">Qty</th>
                      <th className="px-3 py-2 text-right font-medium">Jumlah</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map((c) => {
                      const q = yesterdayQty[c.key] ?? 0;
                      return (
                        <tr key={c.key} className="border-b last:border-0">
                          <td className="px-3 py-2">{c.label}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{q}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                            {formatCurrency(q * c.price * (c.deduction ? -1 : 1))}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t bg-muted/30 font-medium">
                      <td className="px-3 py-2" colSpan={2}>
                        Total Kemarin
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(yesterdayTotal)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Today (editable) */}
          <Card>
            <CardHeader className="flex flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4 text-primary" />
                  Input Hari Ini
                </CardTitle>
                <CardDescription>{formatDate(today)}</CardDescription>
              </div>
              {copied && <Badge variant="success">Disalin dari kemarin</Badge>}
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                      <th className="px-3 py-2 text-left font-medium">Kategori</th>
                      <th className="px-3 py-2 text-right font-medium">Qty</th>
                      <th className="px-3 py-2 text-right font-medium">Jumlah</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map((c) => {
                      const q = todayQty[c.key] ?? 0;
                      return (
                        <tr key={c.key} className="border-b last:border-0">
                          <td className="px-3 py-2">{c.label}</td>
                          <td className="px-3 py-2 text-right">
                            <input
                              type="number"
                              min={0}
                              value={q}
                              disabled={!canInput}
                              onChange={(e) =>
                                setTodayQty((prev) => ({
                                  ...prev,
                                  [c.key]: Math.max(0, Number(e.target.value) || 0),
                                }))
                              }
                              className="h-8 w-20 rounded-md border bg-background px-2 text-right text-sm tabular-nums outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
                            />
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums font-medium">
                            {formatCurrency(q * c.price * (c.deduction ? -1 : 1))}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t bg-primary/5 font-semibold">
                      <td className="px-3 py-2" colSpan={2}>
                        Total Hari Ini
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-primary">
                        {formatCurrency(todayTotal)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
