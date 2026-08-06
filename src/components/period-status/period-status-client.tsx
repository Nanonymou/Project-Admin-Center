"use client";

import { useMemo } from "react";
import { CalendarRange, CheckCircle2, Lock, LockOpen } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { KpiCard } from "@/components/common/kpi-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePersona } from "@/components/providers/persona-provider";
import { SITE_KPI } from "@/lib/mock/site-kpi";
import { buildPeriodLocks } from "@/lib/mock/lock-period";
import { canAccessLocation } from "@/lib/personas";
import { formatCurrency } from "@/lib/utils";

export function PeriodStatusClient() {
  const { persona } = usePersona();

  const scopedSites = useMemo(
    () => SITE_KPI.filter((s) => canAccessLocation(persona, s.locationId, s.projectCode)),
    [persona],
  );

  const rows = useMemo(() => buildPeriodLocks(scopedSites), [scopedSites]);

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

  return (
    <div>
      <PageHeader
        title="Manajemen Periode"
        description="Status closing & kunci periode transaksi per bulan untuk seluruh site dalam scope Anda."
        breadcrumbs={[{ label: "Master Data" }, { label: "Manajemen Periode" }]}
      />

      <div className="space-y-6 p-4 md:p-6">
        <PersonaBanner persona={persona} scopeSummary={`${scopedSites.length} site accessible`} />

        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiCard label="Total Periode" value={counts.total} format="number" icon={CalendarRange} tone="primary" />
          <KpiCard label="Terkunci Penuh" value={counts.fullyLocked} format="number" icon={Lock} tone="success" />
          <KpiCard label="Sebagian" value={counts.inProgress} format="number" icon={LockOpen} tone="warning" />
          <KpiCard label="Masih Terbuka" value={counts.open} format="number" icon={LockOpen} tone="info" />
        </section>

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
                    <Badge variant={done ? "success" : p.locked > 0 ? "warning" : "muted"}>
                      {done ? "Closing selesai" : p.locked > 0 ? "Sebagian" : "Terbuka"}
                    </Badge>
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
    </div>
  );
}
