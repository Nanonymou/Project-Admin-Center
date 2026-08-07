"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowUpRight, FileText, Info, Wallet } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { KpiCard } from "@/components/common/kpi-card";
import { ActivityFilterBar } from "@/components/activity/activity-filter-bar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { usePersona } from "@/components/providers/persona-provider";
import { useActiveSite } from "@/components/providers/active-site-provider";
import { useGlobalFilters } from "@/components/providers/global-filter-provider";
import { LOCATION_OPTIONS, PROJECT_OPTIONS } from "@/lib/mock/filters";
import { canAccessLocation } from "@/lib/personas";
import { SITE_KPI } from "@/lib/mock/site-kpi";
import { SITE_DETAILS, type MockInvoice } from "@/lib/mock/site-detail";
import { buildOutstandingInvoicesFor, summarizeOutstanding } from "@/lib/mock/outstanding";
import { invoiceHref } from "@/lib/mock/invoice-lookup";
import { weightedAverageAge } from "@/lib/aging";
import { cn, formatCurrency } from "@/lib/utils";

const BUCKET_ORDER: MockInvoice["agingBucket"][] = ["0-30", "31-60", "61-90", ">90"];
const BUCKET_COLOR: Record<MockInvoice["agingBucket"], string> = {
  "0-30": "hsl(142 71% 45%)",
  "31-60": "hsl(199 89% 48%)",
  "61-90": "hsl(38 92% 50%)",
  ">90": "hsl(0 84% 60%)",
};

export function AgingDashboardClient() {
  const { persona } = usePersona();
  const { activeWorkspace } = useActiveSite();
  const { filters, setFilters, reset } = useGlobalFilters();
  const [syncWorkspace, setSyncWorkspace] = useState(false);

  const scopedSites = useMemo(
    () => SITE_KPI.filter((s) => canAccessLocation(persona, s.locationId, s.projectCode)),
    [persona],
  );

  const personaProjectOptions = useMemo(
    () => PROJECT_OPTIONS.filter((p) => scopedSites.some((s) => s.projectCode === p.code)),
    [scopedSites],
  );
  const personaLocationOptions = useMemo(
    () => LOCATION_OPTIONS.filter((l) => scopedSites.some((s) => s.locationId === l.id)),
    [scopedSites],
  );

  useEffect(() => {
    const validProjects = new Set(personaProjectOptions.map((p) => p.code));
    const validLocations = new Set(personaLocationOptions.map((l) => l.id));
    const nextProjects = filters.projects.filter((p) => validProjects.has(p));
    const nextLocations = filters.locations.filter((l) => validLocations.has(l));
    if (
      nextProjects.length !== filters.projects.length ||
      nextLocations.length !== filters.locations.length
    ) {
      setFilters({ ...filters, projects: nextProjects, locations: nextLocations });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personaProjectOptions, personaLocationOptions]);

  const selectedLocationIds = useMemo(() => new Set(filters.locations), [filters.locations]);

  const filteredSites = useMemo(
    () =>
      scopedSites.filter((s) => {
        if (syncWorkspace && s.locationId !== activeWorkspace.locationId) return false;
        if (filters.projects.length > 0 && !filters.projects.includes(s.projectCode)) return false;
        if (filters.locations.length > 0 && !selectedLocationIds.has(s.locationId)) return false;
        return true;
      }),
    [scopedSites, syncWorkspace, activeWorkspace.locationId, filters.projects, filters.locations, selectedLocationIds],
  );

  const outstanding = useMemo(
    () => buildOutstandingInvoicesFor(filteredSites, SITE_DETAILS),
    [filteredSites],
  );
  const summary = useMemo(() => summarizeOutstanding(outstanding), [outstanding]);

  const projectAging = useMemo(() => {
    const map = new Map<string, Record<MockInvoice["agingBucket"], number>>();
    for (const inv of outstanding) {
      const row = map.get(inv.projectCode) ?? { "0-30": 0, "31-60": 0, "61-90": 0, ">90": 0 };
      row[inv.agingBucket] += inv.amount;
      map.set(inv.projectCode, row);
    }
    return Array.from(map.entries()).map(([code, buckets]) => ({
      code,
      buckets,
      total: BUCKET_ORDER.reduce((s, b) => s + buckets[b], 0),
    }));
  }, [outstanding]);

  const overduePct = summary.totalAmount > 0 ? (summary.byBucket[">90"].amount / summary.totalAmount) * 100 : 0;

  const [chartDim, setChartDim] = useState<"project" | "location">("project");
  const chartData = useMemo(() => {
    const map = new Map<string, Record<MockInvoice["agingBucket"], number>>();
    for (const inv of outstanding) {
      const key = chartDim === "project" ? inv.projectCode : inv.locationName;
      const row = map.get(key) ?? { "0-30": 0, "31-60": 0, "61-90": 0, ">90": 0 };
      row[inv.agingBucket] += inv.amount;
      map.set(key, row);
    }
    return Array.from(map.entries()).map(([label, buckets]) => ({ label, ...buckets }));
  }, [outstanding, chartDim]);
  const avgAge = useMemo(() => weightedAverageAge(outstanding), [outstanding]);

  const [selectedBucket, setSelectedBucket] = useState<MockInvoice["agingBucket"] | null>(null);
  const bucketInvoices = useMemo(
    () =>
      (selectedBucket ? outstanding.filter((i) => i.agingBucket === selectedBucket) : outstanding)
        .slice()
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 15),
    [outstanding, selectedBucket],
  );

  return (
    <div>
      <PageHeader
        title="Invoice Aging Dashboard"
        description="Analisis umur piutang invoice — distribusi per bucket aging dan kontribusi tiap project."
        breadcrumbs={[{ label: "Operasional" }, { label: "Invoice Aging" }]}
      />

      <div className="space-y-6 p-4 md:p-6">
        <PersonaBanner persona={persona} scopeSummary={`${scopedSites.length} site accessible`} />

        <div className="flex items-start gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>Aging dihitung dari invoice belum settled. Bucket &gt;90 hari berisiko tinggi macet.</span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-card px-3 py-2">
          <label className="inline-flex items-center gap-2 text-xs font-medium">
            <input
              type="checkbox"
              checked={syncWorkspace}
              onChange={(e) => setSyncWorkspace(e.target.checked)}
              className="h-4 w-4"
            />
            Sinkron ke workspace aktif
          </label>
          <span className="text-[11px] text-muted-foreground">
            {syncWorkspace
              ? `Difokuskan ke ${activeWorkspace.projectCode} · ${activeWorkspace.locationName}`
              : `Workspace aktif: ${activeWorkspace.projectCode} · ${activeWorkspace.locationName}`}
          </span>
        </div>

        <ActivityFilterBar
          value={filters}
          onChange={setFilters}
          onReset={reset}
          matchedCount={filteredSites.length}
          projectOptions={personaProjectOptions}
          locationOptions={personaLocationOptions}
        />

        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiCard label="Total Outstanding" value={summary.totalAmount} format="currency-compact" icon={Wallet} tone="primary" />
          <KpiCard label="Jumlah Invoice" value={summary.totalCount} format="number" icon={FileText} tone="info" />
          <KpiCard label=">90 Hari" value={summary.byBucket[">90"].amount} format="currency-compact" icon={AlertTriangle} tone="danger" />
          <KpiCard label="% Risiko Tinggi" value={`${overduePct.toFixed(0)}%`} format="text" icon={AlertTriangle} tone={overduePct >= 20 ? "danger" : "warning"} />
        </section>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle>Distribusi Aging</CardTitle>
              <CardDescription>Nilai outstanding per bucket umur piutang.</CardDescription>
            </div>
            <div className="text-right">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Rata-rata Umur</div>
              <div className="text-lg font-semibold tabular-nums">{avgAge.toFixed(0)} hari</div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {BUCKET_ORDER.map((b) => {
                const data = summary.byBucket[b];
                const pct = summary.totalAmount > 0 ? (data.amount / summary.totalAmount) * 100 : 0;
                const active = selectedBucket === b;
                return (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setSelectedBucket(active ? null : b)}
                    className={cn(
                      "rounded-md border p-3 text-left transition-shadow hover:shadow-sm",
                      active && "ring-2 ring-offset-1",
                    )}
                    style={{ borderColor: BUCKET_COLOR[b], ...(active ? ({ "--tw-ring-color": BUCKET_COLOR[b] } as React.CSSProperties) : {}) }}
                    aria-pressed={active}
                  >
                    <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: BUCKET_COLOR[b] }} />
                      Aging {b}
                    </div>
                    <div className="mt-1 text-lg font-semibold tabular-nums">{formatCurrency(data.amount)}</div>
                    <div className="text-[11px] text-muted-foreground">{data.count} invoice · {pct.toFixed(0)}%</div>
                  </button>
                );
              })}
            </div>
            <div className="flex h-3 overflow-hidden rounded-full">
              {BUCKET_ORDER.map((b) => {
                const pct = summary.totalAmount > 0 ? (summary.byBucket[b].amount / summary.totalAmount) * 100 : 0;
                return <div key={b} style={{ width: `${pct}%`, backgroundColor: BUCKET_COLOR[b] }} />;
              })}
            </div>
          </CardContent>
        </Card>

        {chartData.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle>Perbandingan Nilai Aging</CardTitle>
                <CardDescription>Batang bertumpuk — kontribusi tiap bucket aging.</CardDescription>
              </div>
              <div className="flex items-center gap-1 text-xs">
                {(["project", "location"] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setChartDim(d)}
                    className={cn(
                      "rounded-md border px-2 py-1 text-[11px] font-medium",
                      chartDim === d
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input bg-background hover:bg-accent",
                    )}
                  >
                    {d === "project" ? "Per Project" : "Per Lokasi"}
                  </button>
                ))}
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 32% 91%)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(215 16% 47%)" tickLine={false} axisLine={false} />
                    <YAxis
                      tick={{ fontSize: 10 }}
                      stroke="hsl(215 16% 47%)"
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v: number) => (v >= 1_000_000 ? `${Math.round(v / 1_000_000)}jt` : `${Math.round(v / 1000)}rb`)}
                    />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    {BUCKET_ORDER.map((b) => (
                      <Bar key={b} dataKey={b} stackId="a" fill={BUCKET_COLOR[b]} radius={b === ">90" ? [3, 3, 0, 0] : undefined} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="flex flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle>Invoice per Kategori Aging</CardTitle>
              <CardDescription>
                {selectedBucket ? `Bucket ${selectedBucket}` : "Semua bucket"} · klik kartu di atas untuk memfilter.
              </CardDescription>
            </div>
            {selectedBucket && (
              <button
                type="button"
                onClick={() => setSelectedBucket(null)}
                className="text-[11px] font-medium text-primary hover:underline"
              >
                Reset filter
              </button>
            )}
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2 text-left font-medium">Invoice</th>
                    <th className="px-3 py-2 text-left font-medium">Site</th>
                    <th className="px-3 py-2 text-left font-medium">Aging</th>
                    <th className="px-3 py-2 text-left font-medium">Due</th>
                    <th className="px-3 py-2 text-right font-medium">Nilai</th>
                    <th className="px-3 py-2 text-right font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {bucketInvoices.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                        Tidak ada invoice pada kategori ini.
                      </td>
                    </tr>
                  )}
                  {bucketInvoices.map((inv) => (
                    <tr key={inv.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-3 py-2">
                        <Link href={invoiceHref(inv.invoiceNumber)} className="font-medium tabular-nums text-primary hover:underline">
                          {inv.invoiceNumber}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{inv.projectCode} · {inv.locationName}</td>
                      <td className="px-3 py-2">
                        <span
                          className="inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium text-white"
                          style={{ backgroundColor: BUCKET_COLOR[inv.agingBucket] }}
                        >
                          {inv.agingBucket}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{inv.dueDate}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium">{formatCurrency(inv.amount)}</td>
                      <td className="px-3 py-2 text-right">
                        <Link href={invoiceHref(inv.invoiceNumber)} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                          Detail
                          <ArrowUpRight className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Aging per Project</CardTitle>
            <CardDescription>Kontribusi tiap project pada masing-masing bucket aging.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2 text-left font-medium">Project</th>
                    {BUCKET_ORDER.map((b) => (
                      <th key={b} className="px-3 py-2 text-right font-medium">{b}</th>
                    ))}
                    <th className="px-3 py-2 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {projectAging.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                        Tidak ada invoice outstanding pada scope ini.
                      </td>
                    </tr>
                  )}
                  {projectAging.map((r) => (
                    <tr key={r.code} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-3 py-2 font-medium">{r.code}</td>
                      {BUCKET_ORDER.map((b) => (
                        <td
                          key={b}
                          className={cn("px-3 py-2 text-right tabular-nums", b === ">90" && r.buckets[b] > 0 && "text-rose-600 font-medium")}
                        >
                          {r.buckets[b] > 0 ? formatCurrency(r.buckets[b]) : "—"}
                        </td>
                      ))}
                      <td className="px-3 py-2 text-right tabular-nums font-semibold">{formatCurrency(r.total)}</td>
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
