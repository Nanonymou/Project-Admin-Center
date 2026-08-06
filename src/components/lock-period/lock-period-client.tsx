"use client";

import { useMemo, useState } from "react";
import { Filter, Lock, LockOpen, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { KpiCard } from "@/components/common/kpi-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePersona } from "@/components/providers/persona-provider";
import { SITE_KPI } from "@/lib/mock/site-kpi";
import { buildPeriodLocks, type PeriodLockRow, type PeriodLockState } from "@/lib/mock/lock-period";
import { canAccessLocation } from "@/lib/personas";
import { cn, formatCurrency } from "@/lib/utils";

export function LockPeriodClient() {
  const { persona } = usePersona();
  const [stateFilter, setStateFilter] = useState<PeriodLockState | "all">("all");
  // Local overrides applied by lock/unlock actions this session.
  const [overrides, setOverrides] = useState<Record<string, PeriodLockState>>({});

  const canUnlock = persona.role === "leader_admin" || persona.role === "super_admin";

  const scopedSites = useMemo(
    () => SITE_KPI.filter((s) => canAccessLocation(persona, s.locationId, s.projectCode)),
    [persona],
  );

  const baseRows = useMemo(() => buildPeriodLocks(scopedSites), [scopedSites]);
  const rows = useMemo(
    () => baseRows.map((r) => ({ ...r, state: overrides[r.id] ?? r.state })),
    [baseRows, overrides],
  );

  const filtered = useMemo(
    () => (stateFilter === "all" ? rows : rows.filter((r) => r.state === stateFilter)),
    [rows, stateFilter],
  );

  const counts = useMemo(
    () => ({
      total: rows.length,
      locked: rows.filter((r) => r.state === "locked").length,
      open: rows.filter((r) => r.state === "open").length,
    }),
    [rows],
  );

  function toggle(row: PeriodLockRow) {
    setOverrides((prev) => ({ ...prev, [row.id]: row.state === "locked" ? "open" : "locked" }));
  }

  return (
    <div>
      <PageHeader
        title="Lock Period Management"
        description="Kunci atau buka periode transaksi. Unlock hanya untuk Leader/Super Admin."
        breadcrumbs={[{ label: "Master Data" }, { label: "Lock Period" }]}
      />

      <div className="space-y-6 p-4 md:p-6">
        <PersonaBanner persona={persona} scopeSummary={`${scopedSites.length} site accessible`} />

        {!canUnlock && (
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Peran <b>{persona.roleLabel}</b> tidak dapat mengubah kunci periode. Tampilan hanya-baca.
            </span>
          </div>
        )}

        <section className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <KpiCard label="Total Periode" value={counts.total} format="number" icon={Filter} tone="primary" />
          <KpiCard label="Terkunci" value={counts.locked} format="number" icon={Lock} tone="success" />
          <KpiCard label="Terbuka" value={counts.open} format="number" icon={LockOpen} tone="warning" />
        </section>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle>Daftar Periode</CardTitle>
              <CardDescription>Status kunci periode transaksi per site.</CardDescription>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              {(["all", "locked", "open"] as const).map((s) => (
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
                  {s === "all" ? "Semua" : s === "locked" ? "Terkunci" : "Terbuka"}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2 text-left font-medium">Periode</th>
                    <th className="px-3 py-2 text-left font-medium">Site</th>
                    <th className="px-3 py-2 text-right font-medium">Sales</th>
                    <th className="px-3 py-2 text-right font-medium">Cost</th>
                    <th className="px-3 py-2 text-left font-medium">Status</th>
                    <th className="px-3 py-2 text-left font-medium">Locked</th>
                    <th className="px-3 py-2 text-right font-medium">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">
                        Tidak ada periode untuk filter ini.
                      </td>
                    </tr>
                  )}
                  {filtered.map((r) => (
                    <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-3 py-2 font-medium">{r.periodLabel}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {r.projectCode} · {r.locationName}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(r.salesTotal)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {formatCurrency(r.costTotal)}
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant={r.state === "locked" ? "success" : "warning"} className="inline-flex items-center gap-1">
                          {r.state === "locked" ? <Lock className="h-3 w-3" /> : <LockOpen className="h-3 w-3" />}
                          {r.state === "locked" ? "Locked" : "Open"}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-[11px] text-muted-foreground">
                        {r.state === "locked" && r.lockedBy ? `${r.lockedBy} · ${r.lockedAt}` : "—"}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          size="sm"
                          variant={r.state === "locked" ? "outline" : "default"}
                          className="h-7"
                          disabled={!canUnlock}
                          onClick={() => toggle(r)}
                        >
                          {r.state === "locked" ? (
                            <>
                              <LockOpen className="h-3.5 w-3.5" />
                              Unlock
                            </>
                          ) : (
                            <>
                              <Lock className="h-3.5 w-3.5" />
                              Lock
                            </>
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
    </div>
  );
}
