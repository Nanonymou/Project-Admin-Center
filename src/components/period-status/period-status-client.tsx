"use client";

import { useMemo, useState } from "react";
import { CalendarRange, CheckCircle2, Lock, LockOpen, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { KpiCard } from "@/components/common/kpi-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { usePersona } from "@/components/providers/persona-provider";
import { SITE_KPI } from "@/lib/mock/site-kpi";
import { buildPeriodLocks, type PeriodLockState } from "@/lib/mock/lock-period";
import { CutOffCalculator } from "@/components/period-status/cutoff-calculator";
import { canAccessLocation } from "@/lib/personas";
import { cn, formatCurrency } from "@/lib/utils";

export function PeriodStatusClient() {
  const { persona } = usePersona();
  const canManage = persona.role === "leader_admin" || persona.role === "super_admin";

  const scopedSites = useMemo(
    () => SITE_KPI.filter((s) => canAccessLocation(persona, s.locationId, s.projectCode)),
    [persona],
  );

  const projectCodes = useMemo(
    () => Array.from(new Set(scopedSites.map((s) => s.projectCode))).sort(),
    [scopedSites],
  );

  const baseRows = useMemo(() => buildPeriodLocks(scopedSites), [scopedSites]);
  const [overrides, setOverrides] = useState<Record<string, PeriodLockState>>({});
  const rows = useMemo(
    () => baseRows.map((r) => ({ ...r, state: overrides[r.id] ?? r.state })),
    [baseRows, overrides],
  );

  // Reason-modal state for locking a whole period.
  const [modalPeriodKey, setModalPeriodKey] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);

  // Group per period (month) with lock progress and totals.
  const periods = useMemo(() => {
    const map = new Map<
      string,
      {
        key: string;
        label: string;
        locked: number;
        total: number;
        salesTotal: number;
        costTotal: number;
        sites: typeof rows;
      }
    >();
    for (const r of rows) {
      const entry =
        map.get(r.periodKey) ??
        { key: r.periodKey, label: r.periodLabel, locked: 0, total: 0, salesTotal: 0, costTotal: 0, sites: [] as typeof rows };
      entry.total += 1;
      if (r.state === "locked") entry.locked += 1;
      entry.salesTotal += r.salesTotal;
      entry.costTotal += r.costTotal;
      entry.sites.push(r);
      map.set(r.periodKey, entry);
    }
    return Array.from(map.values()).sort((a, b) => (a.key < b.key ? 1 : -1));
  }, [rows]);

  const counts = useMemo(() => {
    const fullyLocked = periods.filter((p) => p.locked === p.total).length;
    const inProgress = periods.filter((p) => p.locked > 0 && p.locked < p.total).length;
    const open = periods.filter((p) => p.locked === 0).length;
    return { total: periods.length, fullyLocked, inProgress, open };
  }, [periods]);

  const modalPeriod = useMemo(
    () => periods.find((p) => p.key === modalPeriodKey) ?? null,
    [periods, modalPeriodKey],
  );

  function openLockModal(key: string) {
    setModalPeriodKey(key);
    setReason("");
    setTouched(false);
  }

  function confirmLock() {
    setTouched(true);
    if (!modalPeriod || reason.trim().length < 4) return;
    const openIds = modalPeriod.sites.filter((s) => s.state === "open").map((s) => s.id);
    setOverrides((prev) => {
      const next = { ...prev };
      for (const id of openIds) next[id] = "locked";
      return next;
    });
    setModalPeriodKey(null);
    setReason("");
    setTouched(false);
  }

  return (
    <div>
      <PageHeader
        title="Manajemen Periode"
        description="Status closing & kunci periode transaksi per bulan untuk seluruh site dalam scope Anda."
        breadcrumbs={[{ label: "Master Data" }, { label: "Manajemen Periode" }]}
      />

      <div className="space-y-6 p-4 md:p-6">
        <PersonaBanner persona={persona} scopeSummary={`${scopedSites.length} site accessible`} />

        {!canManage && (
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Peran <b>{persona.roleLabel}</b> hanya dapat melihat status periode. Aksi kunci hanya untuk Leader/Super Admin.
            </span>
          </div>
        )}

        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiCard label="Total Periode" value={counts.total} format="number" icon={CalendarRange} tone="primary" />
          <KpiCard label="Terkunci Penuh" value={counts.fullyLocked} format="number" icon={Lock} tone="success" />
          <KpiCard label="Sebagian" value={counts.inProgress} format="number" icon={LockOpen} tone="warning" />
          <KpiCard label="Masih Terbuka" value={counts.open} format="number" icon={LockOpen} tone="info" />
        </section>

        {projectCodes.length > 0 && <CutOffCalculator projectCodes={projectCodes} />}

        {periods.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              Tidak ada periode dalam scope ini.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {periods.map((p) => {
              const pct = p.total > 0 ? (p.locked / p.total) * 100 : 0;
              const done = p.locked === p.total;
              return (
                <Card key={p.key}>
                  <CardHeader className="flex flex-row items-start justify-between space-y-0">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {done ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <CalendarRange className="h-4 w-4 text-primary" />
                        )}
                        {p.label}
                      </CardTitle>
                      <CardDescription>
                        {p.locked} dari {p.total} site terkunci · Sales {formatCurrency(p.salesTotal)} · Cost{" "}
                        {formatCurrency(p.costTotal)}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={done ? "success" : p.locked > 0 ? "warning" : "muted"}>
                        {done ? "Closing selesai" : p.locked > 0 ? "Sebagian" : "Terbuka"}
                      </Badge>
                      {canManage && !done && (
                        <Button size="sm" variant="outline" className="h-7" onClick={() => openLockModal(p.key)}>
                          <Lock className="h-3.5 w-3.5" />
                          Kunci Periode
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {p.sites.map((s) => (
                        <span
                          key={s.id}
                          className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium"
                        >
                          {s.state === "locked" ? (
                            <Lock className="h-3 w-3 text-emerald-600" />
                          ) : (
                            <LockOpen className="h-3 w-3 text-amber-600" />
                          )}
                          {s.projectCode} · {s.locationName}
                        </span>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Dialog
        open={modalPeriod !== null}
        onClose={() => setModalPeriodKey(null)}
        title="Kunci Periode"
        description={modalPeriod ? `${modalPeriod.label} · ${modalPeriod.total - modalPeriod.locked} site terbuka` : undefined}
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setModalPeriodKey(null)}>
              Batal
            </Button>
            <Button size="sm" onClick={confirmLock}>
              <Lock className="h-4 w-4" />
              Kunci Semua Site
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Semua site terbuka pada periode ini akan dikunci. Transaksi tidak dapat diubah setelah dikunci.
          </p>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Alasan <span className="text-rose-600">*</span>
            </label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="mis. Closing bulanan final"
              className={cn(touched && reason.trim().length < 4 && "border-rose-400")}
            />
            {touched && reason.trim().length < 4 && (
              <p className="mt-1 text-[11px] text-rose-600">Alasan minimal 4 karakter.</p>
            )}
          </div>
        </div>
      </Dialog>
    </div>
  );
}
