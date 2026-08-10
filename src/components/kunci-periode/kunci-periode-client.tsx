"use client";

import { useMemo, useState } from "react";
import { Lock, LockOpen, CalendarDays, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePersona } from "@/components/providers/persona-provider";
import { canAccessLocation } from "@/lib/personas";
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

  const rows = baseline.map((r) => ({ ...r, state: overrides[r.id] ?? r.state }));

  const [projectFilter, setProjectFilter] = useState<string>("all");
  const projects = useMemo(
    () => Array.from(new Set(rows.map((r) => r.projectCode))).sort(),
    [rows],
  );
  const visible = rows.filter((r) => projectFilter === "all" || r.projectCode === projectFilter);

  const lockedCount = rows.filter((r) => r.state === "locked").length;

  function toggle(id: string, label: string, current: PeriodLockState) {
    const next: PeriodLockState = current === "locked" ? "open" : "locked";
    setOverrides((prev) => ({ ...prev, [id]: next }));
    setMsg(`Periode ${label} ${next === "locked" ? "dikunci" : "dibuka"}.`);
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
                        <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="px-3 py-2">
                            <span className="font-medium">{r.locationName}</span>
                            <span className="ml-1 text-[11px] text-muted-foreground">{r.projectCode}</span>
                          </td>
                          <td className="px-3 py-2">{r.periodLabel}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                            {formatCurrency(r.salesTotal)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                            {formatCurrency(r.costTotal)}
                          </td>
                          <td className="px-3 py-2">
                            <Badge variant={locked ? "danger" : "success"}>
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
                              onClick={() => toggle(r.id, `${r.locationName} ${r.periodLabel}`, r.state)}
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
    </div>
  );
}
