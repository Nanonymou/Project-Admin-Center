"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlarmClock, CalendarClock, Download, Info, Lock, RefreshCcw, Truck } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { KpiCard } from "@/components/common/kpi-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePersona } from "@/components/providers/persona-provider";
import { SITE_KPI } from "@/lib/mock/site-kpi";
import {
  buildCutOffRows,
  CUTOFF_STATUS_META,
  DELIVERY_STATUS_META,
  type CutOffRow,
} from "@/lib/mock/cutoff-config";
import { Dialog } from "@/components/ui/dialog";
import { NotSubmittedWidget } from "@/components/cutoff/not-submitted-widget";
import { PastCutOffWidget } from "@/components/cutoff/past-cutoff-widget";
import { LockedPeriodsWidget } from "@/components/cutoff/locked-periods-widget";
import { ReopenedPeriodsWidget } from "@/components/cutoff/reopened-periods-widget";
import { canAccessLocation } from "@/lib/personas";
import { cn } from "@/lib/utils";

export function CutOffMonitoringClient() {
  const { persona } = usePersona();
  const [active, setActive] = useState<CutOffRow | null>(null);

  const scopedSites = useMemo(
    () => SITE_KPI.filter((s) => canAccessLocation(persona, s.locationId, s.projectCode)),
    [persona],
  );

  const rows = useMemo(() => buildCutOffRows(scopedSites), [scopedSites]);

  const counts = useMemo(
    () => ({
      total: rows.length,
      critical: rows.filter((r) => r.status === "critical").length,
      closingSoon: rows.filter((r) => r.status === "closing_soon").length,
      pendingDelivery: rows.filter((r) => r.delivery !== "confirmed").length,
    }),
    [rows],
  );

  const canExport = persona.capabilities.canExport;

  return (
    <div>
      <PageHeader
        title="Monitoring Cut-Off & Pengiriman"
        description="Pantau tenggat closing periode invoice dan status pengiriman ke client per site."
        breadcrumbs={[{ label: "Operasional" }, { label: "Cut-Off & Pengiriman" }]}
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

        <div className="flex items-start gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Tanggal cut-off dihitung dari konfigurasi periode invoice tiap project (BUMA 15-14,
            lainnya 1-akhir bulan). Countdown H-x menunjukkan sisa hari sebelum closing.
          </span>
        </div>

        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiCard label="Site Dipantau" value={counts.total} format="number" icon={CalendarClock} tone="primary" />
          <KpiCard label="Critical (H-0)" value={counts.critical} format="number" icon={AlarmClock} tone="danger" />
          <KpiCard label="Closing Soon" value={counts.closingSoon} format="number" icon={CalendarClock} tone="warning" />
          <KpiCard label="Belum Terkonfirmasi" value={counts.pendingDelivery} format="number" icon={Truck} tone="info" />
        </section>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <NotSubmittedWidget sites={scopedSites} kind="sales" />
          <NotSubmittedWidget sites={scopedSites} kind="cost" />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr),minmax(0,1fr)]">
          <PastCutOffWidget sites={scopedSites} />
          <LockedPeriodsWidget sites={scopedSites} />
        </div>

        <ReopenedPeriodsWidget sites={scopedSites} />

        <Card>
          <CardHeader>
            <CardTitle>Status Cut-Off & Pengiriman per Site</CardTitle>
            <CardDescription>Diurutkan berdasarkan tenggat terdekat.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {rows.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                Tidak ada site dalam scope.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                      <th className="px-3 py-2 text-left font-medium">Site</th>
                      <th className="px-3 py-2 text-left font-medium">Periode</th>
                      <th className="px-3 py-2 text-left font-medium">Cut-Off</th>
                      <th className="px-3 py-2 text-center font-medium">Countdown</th>
                      <th className="px-3 py-2 text-left font-medium">Submit</th>
                      <th className="px-3 py-2 text-left font-medium">Status</th>
                      <th className="px-3 py-2 text-left font-medium">Pengiriman</th>
                      <th className="px-3 py-2 text-right font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const st = CUTOFF_STATUS_META[r.status];
                      const dv = DELIVERY_STATUS_META[r.delivery];
                      return (
                        <tr
                          key={r.locationId}
                          onClick={(e) => {
                            if ((e.target as HTMLElement).closest("a")) return;
                            setActive(r);
                          }}
                          className="cursor-pointer border-b last:border-0 hover:bg-muted/30"
                        >
                          <td className="px-3 py-2">
                            <div className="text-sm font-medium">{r.locationName}</div>
                            <div className="text-[11px] text-muted-foreground">{r.projectCode}</div>
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">{r.periodLabel}</td>
                          <td className="px-3 py-2 tabular-nums">{r.cutOffDate}</td>
                          <td className="px-3 py-2 text-center">
                            <span
                              className={cn(
                                "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums",
                                r.daysLeft <= 0
                                  ? "bg-rose-100 text-rose-800"
                                  : r.daysLeft <= 2
                                    ? "bg-amber-100 text-amber-900"
                                    : "bg-emerald-100 text-emerald-800",
                              )}
                            >
                              {r.daysLeft <= 0 ? "Hari ini" : `H-${r.daysLeft}`}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-16 overflow-hidden rounded bg-muted">
                                <div
                                  className={
                                    r.submittedPct >= 90
                                      ? "h-full bg-emerald-500"
                                      : r.submittedPct >= 60
                                        ? "h-full bg-amber-500"
                                        : "h-full bg-rose-500"
                                  }
                                  style={{ width: `${Math.min(100, r.submittedPct)}%` }}
                                />
                              </div>
                              <span className="text-[11px] tabular-nums text-muted-foreground">
                                {r.submittedPct}%
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <Badge variant={st.variant}>{st.label}</Badge>
                          </td>
                          <td className="px-3 py-2">
                            <Badge variant={dv.variant}>{dv.label}</Badge>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <Link
                              href={`/site/${r.locationId}`}
                              className="text-xs font-medium text-primary hover:underline"
                            >
                              Detail →
                            </Link>
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

      <Dialog
        open={active !== null}
        onClose={() => setActive(null)}
        title={active ? `${active.projectCode} · ${active.locationName}` : undefined}
        description={active ? `Periode invoice ${active.periodLabel}` : undefined}
        footer={
          active && (
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">
                Cut-off {active.cutOffDate}
              </span>
              <Link href={`/site/${active.locationId}`}>
                <Button size="sm">Buka Site Dashboard</Button>
              </Link>
            </div>
          )
        }
      >
        {active && (
          <div className="space-y-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={CUTOFF_STATUS_META[active.status].variant}>
                {CUTOFF_STATUS_META[active.status].label}
              </Badge>
              <Badge variant={DELIVERY_STATUS_META[active.delivery].variant}>
                {DELIVERY_STATUS_META[active.delivery].label}
              </Badge>
              <span
                className={cn(
                  "rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums",
                  active.daysLeft <= 0
                    ? "bg-rose-100 text-rose-800"
                    : active.daysLeft <= 2
                      ? "bg-amber-100 text-amber-900"
                      : "bg-emerald-100 text-emerald-800",
                )}
              >
                {active.daysLeft <= 0 ? "Hari ini" : `H-${active.daysLeft}`}
              </span>
            </div>
            <DetailRow label="Cut-off date" value={active.cutOffDate} />
            <DetailRow label="Periode invoice" value={active.periodLabel} />
            <DetailRow label="Invoice pending" value={`${active.pendingInvoices}`} />
            <div>
              <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Progress Submit
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 flex-1 overflow-hidden rounded bg-muted">
                  <div
                    className={
                      active.submittedPct >= 90
                        ? "h-full bg-emerald-500"
                        : active.submittedPct >= 60
                          ? "h-full bg-amber-500"
                          : "h-full bg-rose-500"
                    }
                    style={{ width: `${Math.min(100, active.submittedPct)}%` }}
                  />
                </div>
                <span className="text-xs tabular-nums text-muted-foreground">{active.submittedPct}%</span>
              </div>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b pb-2 last:border-0">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium">{value}</span>
    </div>
  );
}
