"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowUpRight, ClipboardList } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SubmitStatusList } from "@/components/daily-cost/submit-status-list";
import { ClosingStatusBadge } from "@/components/daily-closing/closing-status-badge";
import { usePersona } from "@/components/providers/persona-provider";
import { SITE_KPI } from "@/lib/mock/site-kpi";
import { canAccessLocation } from "@/lib/personas";
import {
  buildSubmitStatus,
  CLOSING_STATES,
  CLOSING_STATE_META,
  type ClosingState,
} from "@/lib/mock/closing-status";

export function DailyClosingClient() {
  const { persona } = usePersona();

  const scopedSites = useMemo(
    () => SITE_KPI.filter((s) => canAccessLocation(persona, s.locationId, s.projectCode)),
    [persona],
  );

  const rows = useMemo(() => buildSubmitStatus(scopedSites), [scopedSites]);

  // Distribution of sites by their overall closing state (min of sales & cost).
  const distribution = useMemo(() => {
    const counts: Record<ClosingState, number> = {
      draft: 0,
      submitted: 0,
      reviewed: 0,
      approved: 0,
      locked: 0,
    };
    for (const r of rows) {
      const overall =
        CLOSING_STATE_META[r.costState].step <= CLOSING_STATE_META[r.salesState].step
          ? r.costState
          : r.salesState;
      counts[overall] += 1;
    }
    return counts;
  }, [rows]);

  const total = rows.length;

  return (
    <div>
      <PageHeader
        title="Alur Daily Closing"
        description="Status closing harian per site: Draft → Submitted → Reviewed → Approved → Locked."
        breadcrumbs={[{ label: "Operasional" }, { label: "Daily Closing" }]}
      />

      <div className="space-y-6 p-4 md:p-6">
        <PersonaBanner persona={persona} scopeSummary={`${scopedSites.length} site accessible`} />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-primary" />
              Distribusi Status Closing
            </CardTitle>
            <CardDescription>Jumlah site pada tiap tahap closing (berdasarkan tahap paling awal).</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {CLOSING_STATES.map((state) => {
                const meta = CLOSING_STATE_META[state];
                const count = distribution[state];
                const pct = total > 0 ? (count / total) * 100 : 0;
                return (
                  <div key={state} className="rounded-md border p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        Tahap {meta.step}
                      </span>
                      <ClosingStatusBadge state={state} />
                    </div>
                    <div className="mt-2 text-2xl font-bold tabular-nums">{count}</div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Status Closing per Site</CardTitle>
            <CardDescription>Progress Daily Sales & Daily Cost closing untuk site dalam scope Anda.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <SubmitStatusList rows={rows} />
          </CardContent>
        </Card>

        {rows.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Detail Periode per Site</CardTitle>
              <CardDescription>Buka detail closing untuk melihat/mengedit status penutupan.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {rows.map((r) => (
                  <Link
                    key={r.locationId}
                    href={`/daily-closing/${r.locationId}`}
                    className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-medium hover:bg-accent"
                  >
                    {r.projectCode} · {r.locationName}
                    <ArrowUpRight className="h-3 w-3" />
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
