"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Lock, LockOpen, CalendarDays, ShieldCheck, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { usePersona } from "@/components/providers/persona-provider";
import { canAccessLocation } from "@/lib/personas";
import { personaHeaders } from "@/lib/client/notif";
import { cn, formatCurrency } from "@/lib/utils";
import { SITE_KPI } from "@/lib/mock/site-kpi";
import { buildPeriodLocks, type PeriodLockState } from "@/lib/mock/lock-period";

/**
 * Kunci Periode (period lock) page. Lists recent monthly periods per site with a
 * lock state; a Leader/Super Admin can lock or unlock a period, which freezes
 * further edits. Locking is session-local (mock). Persona-scoped — a Site Admin
 * sees only their own sites and cannot change locks.
 */
export function KunciPeriodeClient() {
  const { persona } = usePersona();
  const canManageLocks = persona.role === "leader_admin" || persona.role === "super_admin";

  const sites = useMemo(
    () => SITE_KPI.filter((s) => canAccessLocation(persona, s.locationId, s.projectCode)),
    [persona],
  );
  const baseline = useMemo(() => buildPeriodLocks(sites), [sites]);

  const [overrides, setOverrides] = useState<Record<string, PeriodLockState>>({});
  const [msg, setMsg] = useState<string | null>(null);

  // Reflect the persisted lock status from the DB, matched by location+period.
  const loadLocks = useCallback(async () => {
    try {
      const res = await fetch("/api/lock-period?scope=executive", { cache: "no-store", headers: personaHeaders(persona.id) });
      const data = (await res.json()) as {
        source?: string;
        periods?: Array<{ locationId: string; periodLabel: string; locked?: boolean; state?: string }>;
      };
      if (data.source !== "db" || !Array.isArray(data.periods)) return;
      const stateByKey = new Map<string, PeriodLockState>();
      for (const p of data.periods) {
        const locked = p.locked ?? p.state === "locked";
        stateByKey.set(`${p.locationId}|${p.periodLabel}`, locked ? "locked" : "open");
      }
      const next: Record<string, PeriodLockState> = {};
      for (const r of baseline) {
        const s = stateByKey.get(`${r.locationId}|${r.periodLabel}`);
        if (s) next[r.id] = s;
      }
      if (Object.keys(next).length > 0) setOverrides((prev) => ({ ...next, ...prev }));
    } catch {
      /* keep config baseline */
    }
  }, [persona.id, baseline]);

  useEffect(() => {
    void loadLocks();
  }, [loadLocks]);

  const rows = baseline.map((r) => ({ ...r, state: overrides[r.id] ?? r.state }));

  const [projectFilter, setProjectFilter] = useState<string>("all");
  const projects = useMemo(
    () => Array.from(new Set(rows.map((r) => r.projectCode))).sort(),
    [rows],
  );
  const visible = rows.filter((r) => projectFilter === "all" || r.projectCode === projectFilter);

  const lockedCount = rows.filter((r) => r.state === "locked").length;

  const [confirmRow, setConfirmRow] = useState<{
    id: string;
    label: string;
    state: PeriodLockState;
    projectCode: string;
    locationId: string;
    periodLabel: string;
  } | null>(null);

  function requestToggle(r: {
    id: string;
    locationName: string;
    periodLabel: string;
    projectCode: string;
    locationId: string;
    state: PeriodLockState;
  }) {
    if (!canManageLocks) return;
    setConfirmRow({
      id: r.id,
      label: `${r.locationName} ${r.periodLabel}`,
      state: r.state,
      projectCode: r.projectCode,
      locationId: r.locationId,
      periodLabel: r.periodLabel,
    });
  }

  async function applyToggle() {
    if (!confirmRow) return;
    const row = confirmRow;
    const next: PeriodLockState = row.state === "locked" ? "open" : "locked";
    setOverrides((prev) => ({ ...prev, [row.id]: next }));
    setMsg(`Periode ${row.label} ${next === "locked" ? "dikunci" : "dibuka"} oleh ${persona.roleLabel}.`);
    setConfirmRow(null);

    // Persist the lock/unlock to the database.
    try {
      await fetch("/api/lock-period", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...personaHeaders(persona.id) },
        body: JSON.stringify({
          projectId: row.projectCode,
          locationId: row.locationId,
          periodLabel: row.periodLabel,
          action: next === "locked" ? "lock" : "unlock",
        }),
      });
      await loadLocks();
    } catch {
      /* keep optimistic */
    }
  }

  return (
    <div>
      <PageHeader
        title="Kunci Periode"
        description="Kunci periode bulanan agar data Daily Sales & Cost tidak dapat diubah setelah closing."
        breadcrumbs={[{ label: "Master Data" }, { label: "Kunci Periode" }]}
      />

      <div className="space-y-6 p-4 md:p-6">
        <PersonaBanner
          persona={persona}
          scopeSummary={canManageLocks ? "Dapat mengunci periode" : "Hanya melihat"}
        />

        {msg && (
          <div className="flex items-center gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">
            <ShieldCheck className="h-4 w-4 shrink-0" />
            <span>{msg}</span>
          </div>
        )}

        {!canManageLocks && (
          <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            <span>
              Aksi kunci/buka periode hanya untuk <b>Leader Admin</b> atau <b>Super Admin</b>. Anda dapat
              melihat status, namun tidak dapat mengubah kunci.
            </span>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {lockedCount} dari {rows.length} periode terkunci
          </span>
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="ml-auto h-8 rounded-md border bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="all">Semua Project</option>
            {projects.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Status Kunci Periode</CardTitle>
            <CardDescription>{visible.length} periode pada cakupan Anda.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {visible.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">Tidak ada periode.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                      <th className="px-3 py-2 text-left font-medium">Site</th>
                      <th className="px-3 py-2 text-left font-medium">Periode</th>
                      <th className="px-3 py-2 text-right font-medium">Sales</th>
                      <th className="px-3 py-2 text-right font-medium">Cost</th>
                      <th className="px-3 py-2 text-left font-medium">Status</th>
                      <th className="px-3 py-2 text-right font-medium">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((r) => {
                      const locked = r.state === "locked";
                      return (
                        <tr
                          key={r.id}
                          className={cn(
                            "border-b last:border-0 hover:bg-muted/30",
                            locked && "bg-rose-50/40",
                          )}
                        >
                          <td className="px-3 py-2">
                            <span className="font-medium">{r.locationName}</span>
                            <span className="ml-1 text-[11px] text-muted-foreground">{r.projectCode}</span>
                          </td>
                          <td className="px-3 py-2">
                            <span className="inline-flex items-center gap-1.5">
                              {locked && <Lock className="h-3.5 w-3.5 text-rose-500" />}
                              {r.periodLabel}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                            {formatCurrency(r.salesTotal)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                            {formatCurrency(r.costTotal)}
                          </td>
                          <td className="px-3 py-2">
                            <Badge variant={locked ? "danger" : "success"} className="inline-flex items-center gap-1">
                              {locked ? <Lock className="h-3 w-3" /> : <LockOpen className="h-3 w-3" />}
                              {locked ? "Terkunci" : "Terbuka"}
                            </Badge>
                            {locked && r.lockedBy && (
                              <div className="text-[11px] text-muted-foreground">
                                oleh {r.lockedBy}
                                {r.lockedAt ? ` · ${r.lockedAt}` : ""}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <Button
                              size="sm"
                              variant={locked ? "outline" : "default"}
                              disabled={!canManageLocks}
                              title={
                                canManageLocks
                                  ? locked
                                    ? "Buka kunci periode"
                                    : "Kunci periode"
                                  : "Hanya Leader/Super Admin"
                              }
                              onClick={() => requestToggle(r)}
                              className={cn(locked && "text-emerald-700")}
                            >
                              {locked ? (
                                <>
                                  <LockOpen className="h-4 w-4" />
                                  Buka
                                </>
                              ) : (
                                <>
                                  <Lock className="h-4 w-4" />
                                  Kunci
                                </>
                              )}
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Lock/unlock confirmation */}
      <Dialog
        open={confirmRow !== null}
        onClose={() => setConfirmRow(null)}
        title={confirmRow?.state === "locked" ? "Buka kunci periode?" : "Kunci periode?"}
        description={confirmRow?.label}
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setConfirmRow(null)}>
              Batal
            </Button>
            <Button size="sm" onClick={applyToggle}>
              {confirmRow?.state === "locked" ? (
                <>
                  <LockOpen className="h-4 w-4" />
                  Buka Kunci
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4" />
                  Kunci
                </>
              )}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-muted-foreground">
          {confirmRow?.state === "locked"
            ? "Membuka kunci mengizinkan kembali perubahan Daily Sales & Cost pada periode ini."
            : "Mengunci periode akan mencegah perubahan Daily Sales & Cost pada periode ini. Hanya Leader/Super Admin yang dapat membukanya kembali."}
        </p>
      </Dialog>
    </div>
  );
}
