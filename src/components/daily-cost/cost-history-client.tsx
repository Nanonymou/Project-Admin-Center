"use client";

import { useMemo, useState } from "react";
import { Download, Filter, History, Lock, RefreshCcw, Search } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { KpiCard } from "@/components/common/kpi-card";
import { usePersona } from "@/components/providers/persona-provider";
import { SITE_KPI } from "@/lib/mock/site-kpi";
import { buildCostHistory, type CostHistoryEntry } from "@/lib/mock/cost-history";
import { CLOSING_STATE_META, type ClosingState } from "@/lib/mock/closing-status";
import { canAccessLocation } from "@/lib/personas";
import { cn, formatCurrency } from "@/lib/utils";

const STATE_FILTERS: (ClosingState | "all")[] = ["all", "submitted", "reviewed", "approved", "locked"];

export function CostHistoryClient() {
  const { persona } = usePersona();
  const [stateFilter, setStateFilter] = useState<ClosingState | "all">("all");
  const [search, setSearch] = useState("");
  const [active, setActive] = useState<CostHistoryEntry | null>(null);

  const scopedSites = useMemo(
    () => SITE_KPI.filter((s) => canAccessLocation(persona, s.locationId, s.projectCode)),
    [persona],
  );

  const history = useMemo(() => buildCostHistory(scopedSites), [scopedSites]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return history.filter((e) => {
      if (stateFilter !== "all" && e.state !== stateFilter) return false;
      if (q && !e.locationName.toLowerCase().includes(q) && !e.dateLabel.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [history, stateFilter, search]);

  const totalAmount = filtered.reduce((s, e) => s + e.total, 0);
  const lockedCount = history.filter((e) => e.state === "locked").length;
  const canExport = persona.capabilities.canExport;

  return (
    <div>
      <PageHeader
        title="Riwayat Submit Daily Cost"
        description="Histori penginputan Daily Cost lintas hari & site dalam scope Anda."
        breadcrumbs={[{ label: "Operasional" }, { label: "Riwayat Daily Cost" }]}
        actions={
          <>
            <Button variant="outline" size="sm">
              <RefreshCcw className="h-4 w-4" />
              Refresh
            </Button>
            <Button
              size="sm"
              disabled={!canExport}
              className={cn(!canExport && "cursor-not-allowed opacity-60")}
              title={canExport ? undefined : "Peran Anda tidak memiliki izin export"}
            >
              {canExport ? <Download className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
              Export
            </Button>
          </>
        }
      />

      <div className="space-y-6 p-4 md:p-6">
        <PersonaBanner persona={persona} scopeSummary={`${scopedSites.length} site accessible`} />

        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiCard label="Total Entri" value={history.length} format="number" icon={History} tone="primary" />
          <KpiCard label="Nilai (filter)" value={totalAmount} format="currency" icon={History} tone="warning" />
          <KpiCard label="Locked" value={lockedCount} format="number" icon={Lock} tone="success" />
          <KpiCard label="Ditampilkan" value={filtered.length} format="number" icon={Filter} tone="info" />
        </section>

        <Card>
          <CardHeader>
            <CardTitle>Riwayat</CardTitle>
            <CardDescription>Klik baris untuk melihat rincian per kategori.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <Filter className="h-3 w-3" />
                Status
              </span>
              {STATE_FILTERS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStateFilter(s)}
                  className={cn(
                    "rounded-md border px-2.5 py-1 text-xs font-medium",
                    stateFilter === s
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-background hover:bg-accent",
                  )}
                >
                  {s === "all" ? "Semua" : CLOSING_STATE_META[s].label}
                </button>
              ))}
              <div className="relative ml-auto min-w-[200px] flex-1 sm:max-w-xs">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari site atau tanggal…"
                  className="pl-8"
                />
              </div>
            </div>

            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2 text-left font-medium">Tanggal</th>
                    <th className="px-3 py-2 text-left font-medium">Site</th>
                    <th className="px-3 py-2 text-left font-medium">Status</th>
                    <th className="px-3 py-2 text-left font-medium">Oleh</th>
                    <th className="px-3 py-2 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                        Tidak ada riwayat cocok filter.
                      </td>
                    </tr>
                  )}
                  {filtered.slice(0, 100).map((e) => (
                    <tr
                      key={e.id}
                      onClick={() => setActive(e)}
                      className="cursor-pointer border-b last:border-0 hover:bg-muted/30"
                    >
                      <td className="px-3 py-2 tabular-nums">{e.dateLabel}</td>
                      <td className="px-3 py-2">
                        <div className="text-sm">{e.locationName}</div>
                        <div className="text-[11px] text-muted-foreground">{e.projectCode}</div>
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant={CLOSING_STATE_META[e.state].variant}>
                          {CLOSING_STATE_META[e.state].label}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{e.submittedBy}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium">
                        {formatCurrency(e.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filtered.length > 100 && (
              <div className="text-center text-[11px] text-muted-foreground">
                Menampilkan 100 dari {filtered.length} entri.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={active !== null}
        onClose={() => setActive(null)}
        title={active ? `Daily Cost — ${active.dateLabel}` : undefined}
        description={active ? `${active.projectCode} · ${active.locationName} · oleh ${active.submittedBy}` : undefined}
      >
        {active && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Badge variant={CLOSING_STATE_META[active.state].variant}>
                {CLOSING_STATE_META[active.state].label}
              </Badge>
              <span className="text-sm font-semibold tabular-nums">{formatCurrency(active.total)}</span>
            </div>
            <ul className="divide-y rounded-md border">
              {active.breakdown.map((b) => (
                <li key={b.label} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span className="text-muted-foreground">{b.label}</span>
                  <span className="tabular-nums font-medium">{formatCurrency(b.amount)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Dialog>
    </div>
  );
}
