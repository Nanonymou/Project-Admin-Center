"use client";

import { useMemo, useState } from "react";
import { LockOpen, Lock, CalendarDays } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

  const [projectFilter, setProjectFilter] = useState<string>("all");
  const projects = useMemo(
    () => Array.from(new Set(lockedPeriods.map((r) => r.projectCode))).sort(),
    [lockedPeriods],
  );
  const visible = lockedPeriods.filter((r) => projectFilter === "all" || r.projectCode === projectFilter);

  return (
    <div>
      <PageHeader
        title="Unlock Period"
        description="Daftar periode terkunci — ajukan atau setujui pembukaan kembali periode."
        breadcrumbs={[{ label: "Master Data" }, { label: "Unlock Period" }]}
      />

      <div className="space-y-6 p-4 md:p-6">
        <PersonaBanner persona={persona} scopeSummary={`${lockedPeriods.length} periode terkunci`} />

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
                      </tr>
                    ))}
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
