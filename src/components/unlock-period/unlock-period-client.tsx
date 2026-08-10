"use client";

import { useMemo, useState } from "react";
import { LockOpen, Lock, CalendarDays, ShieldAlert, CheckCircle2, History } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { usePersona } from "@/components/providers/persona-provider";
import { canAccessLocation } from "@/lib/personas";
import { formatCurrency } from "@/lib/utils";
import { SITE_KPI } from "@/lib/mock/site-kpi";
import { buildPeriodLocks } from "@/lib/mock/lock-period";

export type UnlockRequestState = "locked" | "requested" | "unlocked";

/**
 * Unlock Period — list of currently locked periods. This page shows only locked
 * periods so an admin can request an unlock; Leader/Super Admin can approve the
 * unlock directly. State transitions are session-local (mock). Persona-scoped.
 * The list itself is the deliverable for this task; actions come next.
 */
export function UnlockPeriodClient() {
  const { persona } = usePersona();

  const sites = useMemo(
    () => SITE_KPI.filter((s) => canAccessLocation(persona, s.locationId, s.projectCode)),
    [persona],
  );

  // Only locked periods are relevant on this page.
  const lockedPeriods = useMemo(
    () => buildPeriodLocks(sites).filter((r) => r.state === "locked"),
    [sites],
  );

  const canUnlock = persona.role === "leader_admin" || persona.role === "super_admin";

  const [projectFilter, setProjectFilter] = useState<string>("all");
  const projects = useMemo(
    () => Array.from(new Set(lockedPeriods.map((r) => r.projectCode))).sort(),
    [lockedPeriods],
  );

  // Session-local: ids that have been unlocked this session (hidden from list).
  const [unlockedIds, setUnlockedIds] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState<string | null>(null);

  type UnlockActivity = {
    id: string;
    period: string;
    by: string;
    reason: string;
    at: string;
    session?: boolean;
  };

  // Seeded past unlock activity (deterministic mock).
  const seededHistory = useMemo<UnlockActivity[]>(() => {
    const src = lockedPeriods.slice(0, 3);
    return src.map((r, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (i + 1) * 3);
      return {
        id: `seed-hist-${r.id}`,
        period: `${r.locationName} ${r.periodLabel}`,
        by: "Leader Admin",
        reason: ["Koreksi nominal invoice", "Revisi data cost", "Penyesuaian pajak"][i % 3],
        at: d.toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }),
      };
    });
  }, [lockedPeriods]);

  const [sessionHistory, setSessionHistory] = useState<UnlockActivity[]>([]);
  const history = [...sessionHistory, ...seededHistory];

  const visible = lockedPeriods.filter(
    (r) =>
      !unlockedIds.has(r.id) && (projectFilter === "all" || r.projectCode === projectFilter),
  );

  // Confirmation modal state.
  const [target, setTarget] = useState<{ id: string; label: string } | null>(null);
  const [reason, setReason] = useState("");

  function requestUnlock(id: string, label: string) {
    if (!canUnlock) return;
    setTarget({ id, label });
    setReason("");
  }

  function confirmUnlock() {
    if (!target || reason.trim().length < 3) return;
    setUnlockedIds((prev) => new Set(prev).add(target.id));
    setSessionHistory((prev) => [
      {
        id: `sess-${Date.now()}`,
        period: target.label,
        by: persona.roleLabel,
        reason: reason.trim(),
        at: new Date().toLocaleString("id-ID", {
          day: "2-digit",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        }),
        session: true,
      },
      ...prev,
    ]);
    setMsg(`Periode ${target.label} dibuka oleh ${persona.roleLabel}. Alasan: ${reason.trim()}`);
    setTarget(null);
  }

  return (
    <div>
      <PageHeader
        title="Unlock Period"
        description="Daftar periode terkunci — ajukan atau setujui pembukaan kembali periode."
        breadcrumbs={[{ label: "Master Data" }, { label: "Unlock Period" }]}
      />

      <div className="space-y-6 p-4 md:p-6">
        <PersonaBanner persona={persona} scopeSummary={`${lockedPeriods.length} periode terkunci`} />

        {msg && (
          <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{msg}</span>
          </div>
        )}

        {!canUnlock && (
          <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            <span>
              Membuka kunci periode hanya dapat dilakukan oleh <b>Leader Admin</b> atau{" "}
              <b>Super Admin</b>. Silakan ajukan ke Leader Admin.
            </span>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {lockedPeriods.length} periode terkunci pada cakupan Anda
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
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-rose-500" />
              Periode Terkunci
            </CardTitle>
            <CardDescription>{visible.length} periode.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {visible.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-center">
                <LockOpen className="h-8 w-8 text-emerald-500" />
                <div className="text-sm font-medium">Tidak ada periode terkunci</div>
                <p className="max-w-xs text-xs text-muted-foreground">
                  Semua periode pada cakupan Anda saat ini terbuka.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                      <th className="px-3 py-2 text-left font-medium">Site</th>
                      <th className="px-3 py-2 text-left font-medium">Periode</th>
                      <th className="px-3 py-2 text-right font-medium">Sales</th>
                      <th className="px-3 py-2 text-right font-medium">Cost</th>
                      <th className="px-3 py-2 text-left font-medium">Dikunci</th>
                      <th className="px-3 py-2 text-right font-medium">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((r) => (
                      <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-3 py-2">
                          <span className="font-medium">{r.locationName}</span>
                          <span className="ml-1 text-[11px] text-muted-foreground">{r.projectCode}</span>
                        </td>
                        <td className="px-3 py-2">
                          <span className="inline-flex items-center gap-1.5">
                            <Lock className="h-3.5 w-3.5 text-rose-500" />
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
                          <Badge variant="danger">Terkunci</Badge>
                          <div className="text-[11px] text-muted-foreground">
                            {r.lockedBy ?? "System"}
                            {r.lockedAt ? ` · ${r.lockedAt}` : ""}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right">
                          {canUnlock ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => requestUnlock(r.id, `${r.locationName} ${r.periodLabel}`)}
                            >
                              <LockOpen className="h-4 w-4" />
                              Buka Kunci
                            </Button>
                          ) : (
                            <span className="text-[11px] text-muted-foreground">Perlu Leader Admin</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Unlock activity history */}
        {history.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-4 w-4 text-primary" />
                Riwayat Aktivitas Buka Kunci
              </CardTitle>
              <CardDescription>Catatan pembukaan periode beserta alasannya.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                      <th className="px-3 py-2 text-left font-medium">Waktu</th>
                      <th className="px-3 py-2 text-left font-medium">Periode</th>
                      <th className="px-3 py-2 text-left font-medium">Oleh</th>
                      <th className="px-3 py-2 text-left font-medium">Alasan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((h) => (
                      <tr key={h.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-3 py-2 whitespace-nowrap text-xs">
                          {h.at}
                          {h.session && (
                            <Badge variant="info" className="ml-2">
                              Baru
                            </Badge>
                          )}
                        </td>
                        <td className="px-3 py-2">{h.period}</td>
                        <td className="px-3 py-2 text-muted-foreground">{h.by}</td>
                        <td className="px-3 py-2 text-muted-foreground">{h.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Unlock confirmation modal */}
      <Dialog
        open={target !== null}
        onClose={() => setTarget(null)}
        title="Buka kunci periode?"
        description={target?.label}
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setTarget(null)}>
              Batal
            </Button>
            <Button size="sm" disabled={reason.trim().length < 3} onClick={confirmUnlock}>
              <LockOpen className="h-4 w-4" />
              Buka Kunci
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Membuka kunci mengizinkan kembali perubahan Daily Sales &amp; Cost pada periode ini. Tindakan
            ini tercatat pada log audit. Berikan alasan pembukaan:
          </p>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="Contoh: koreksi nominal invoice sesuai temuan finance."
            className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          {reason.trim().length > 0 && reason.trim().length < 3 && (
            <p className="text-[11px] text-rose-600">Alasan minimal 3 karakter.</p>
          )}
        </div>
      </Dialog>
    </div>
  );
}
