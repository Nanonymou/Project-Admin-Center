"use client";

import { Fragment, useMemo, useState } from "react";
import { GitCompareArrows, Building2, MapPin, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePersona } from "@/components/providers/persona-provider";
import { canAccessLocation } from "@/lib/personas";
import { cn, formatCurrencyCompact } from "@/lib/utils";
import { ChevronRight } from "lucide-react";
import { SITE_KPI } from "@/lib/mock/site-kpi";

type CompareMode = "project" | "location";

type CompareRow = {
  key: string;
  label: string;
  sub: string;
  sales: number;
  cost: number;
  netMargin: number;
  marginPct: number;
  slaPct: number;
  siteCount: number;
};

/**
 * Project & Location Comparison — compares performance either grouped by project
 * or broken out per location, toggled by a mode switch. This task establishes the
 * layout and the grouping/toggle; later tasks add charts and metric selection.
 * Persona-scoped, frontend-first (aggregated from SITE_KPI).
 */
type SortKey = "label" | "sales" | "cost" | "netMargin" | "marginPct" | "slaPct";
type SortDir = "asc" | "desc";

function ExpandStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-background p-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-sm font-medium capitalize">{value}</p>
    </div>
  );
}

function SortHeader({
  label,
  col,
  align,
  sortKey,
  sortDir,
  onSort,
}: {
  label: string;
  col: SortKey;
  align: "left" | "right";
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (k: SortKey) => void;
}) {
  const active = sortKey === col;
  const Icon = !active ? ChevronsUpDown : sortDir === "asc" ? ChevronUp : ChevronDown;
  return (
    <th className={cn("py-2", align === "right" ? "px-3 text-right" : "pr-3 text-left")}>
      <button
        type="button"
        onClick={() => onSort(col)}
        className={cn(
          "inline-flex items-center gap-1 hover:text-foreground",
          align === "right" && "flex-row-reverse",
          active && "text-foreground",
        )}
      >
        {label}
        <Icon className="h-3 w-3" />
      </button>
    </th>
  );
}

export function ComparisonClient() {
  const { persona } = usePersona();
  const [mode, setMode] = useState<CompareMode>("project");
  const [sortKey, setSortKey] = useState<SortKey>("netMargin");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [chartMetric, setChartMetric] = useState<"netMargin" | "sales" | "cost" | "marginPct">("netMargin");

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      // Text sorts default ascending; numeric sorts default descending.
      setSortDir(key === "label" ? "asc" : "desc");
    }
  }

  const scopedSites = useMemo(
    () => SITE_KPI.filter((s) => canAccessLocation(persona, s.locationId, s.projectCode)),
    [persona],
  );

  const rows = useMemo<CompareRow[]>(() => {
    let base: CompareRow[];
    if (mode === "location") {
      base = scopedSites.map((s) => ({
        key: s.locationId,
        label: s.locationName,
        sub: s.projectCode,
        sales: s.sales,
        cost: s.cost,
        netMargin: s.sales - s.cost,
        marginPct: s.sales > 0 ? ((s.sales - s.cost) / s.sales) * 100 : 0,
        slaPct: s.slaPct,
        siteCount: 1,
      }));
    } else {
      const byProject = new Map<string, typeof scopedSites>();
      for (const s of scopedSites) {
        byProject.set(s.projectCode, [...(byProject.get(s.projectCode) ?? []), s]);
      }
      base = Array.from(byProject.entries()).map(([projectCode, sites]) => {
        const sales = sites.reduce((sum, x) => sum + x.sales, 0);
        const cost = sites.reduce((sum, x) => sum + x.cost, 0);
        const slaPct = sites.reduce((sum, x) => sum + x.slaPct, 0) / sites.length;
        return {
          key: projectCode,
          label: sites[0].projectName,
          sub: `${projectCode} · ${sites.length} site`,
          sales,
          cost,
          netMargin: sales - cost,
          marginPct: sales > 0 ? ((sales - cost) / sales) * 100 : 0,
          slaPct,
          siteCount: sites.length,
        };
      });
    }

    const dir = sortDir === "asc" ? 1 : -1;
    return [...base].sort((a, b) => {
      if (sortKey === "label") return a.label.localeCompare(b.label) * dir;
      return (a[sortKey] - b[sortKey]) * dir;
    });
  }, [scopedSites, mode, sortKey, sortDir]);

  const siteByLocation = useMemo(
    () => new Map(scopedSites.map((s) => [s.locationId, s])),
    [scopedSites],
  );

  const maxSales = useMemo(() => Math.max(1, ...rows.map((r) => r.sales)), [rows]);

  const METRIC_LABEL: Record<typeof chartMetric, string> = {
    netMargin: "Net Margin",
    sales: "Sales",
    cost: "Cost",
    marginPct: "Margin %",
  };
  const isPercentMetric = chartMetric === "marginPct";
  const maxMetric = useMemo(
    () => Math.max(1, ...rows.map((r) => Math.abs(r[chartMetric]))),
    [rows, chartMetric],
  );
  const fmtMetric = (v: number) => (isPercentMetric ? `${v.toFixed(1)}%` : formatCurrencyCompact(v));
  const maxValue = useMemo(
    () => Math.max(1, ...rows.flatMap((r) => [r.sales, r.cost])),
    [rows],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Perbandingan Project & Lokasi"
        description="Bandingkan kinerja antar project atau antar lokasi — penjualan, biaya, margin, dan SLA."
      />
      <PersonaBanner persona={persona} scopeSummary={`${scopedSites.length} site accessible`} />

      <div className="inline-flex rounded-lg border p-1 text-sm">
        <button
          type="button"
          onClick={() => setMode("project")}
          className={cn(
            "inline-flex items-center gap-1 rounded-md px-3 py-1",
            mode === "project" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent",
          )}
        >
          <Building2 className="h-4 w-4" /> Per Project
        </button>
        <button
          type="button"
          onClick={() => setMode("location")}
          className={cn(
            "inline-flex items-center gap-1 rounded-md px-3 py-1",
            mode === "location" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent",
          )}
        >
          <MapPin className="h-4 w-4" /> Per Lokasi
        </button>
      </div>

      {mode === "project" && rows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Sales vs Cost Antar Project
            </CardTitle>
            <CardDescription>Perbandingan penjualan dan biaya per project.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 pb-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-sm bg-sky-500" /> Sales
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-sm bg-amber-400" /> Cost
              </span>
            </div>
            <div className="space-y-3">
              {rows.map((r) => (
                <div key={r.key}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium">{r.label}</span>
                    <span className="text-muted-foreground">
                      Margin {r.marginPct.toFixed(1)}%
                    </span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="h-3 flex-1 overflow-hidden rounded bg-muted">
                        <div className="h-full rounded bg-sky-500" style={{ width: `${(r.sales / maxValue) * 100}%` }} />
                      </div>
                      <span className="w-16 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
                        {formatCurrencyCompact(r.sales)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-3 flex-1 overflow-hidden rounded bg-muted">
                        <div className="h-full rounded bg-amber-400" style={{ width: `${(r.cost / maxValue) * 100}%` }} />
                      </div>
                      <span className="w-16 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
                        {formatCurrencyCompact(r.cost)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {rows.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <GitCompareArrows className="h-5 w-5" />
                  Grafik Perbandingan {METRIC_LABEL[chartMetric]}
                </CardTitle>
                <CardDescription>Bandingkan satu metrik antar {mode === "project" ? "project" : "lokasi"}.</CardDescription>
              </div>
              <select
                value={chartMetric}
                onChange={(e) => setChartMetric(e.target.value as typeof chartMetric)}
                className="rounded-md border bg-background px-2 py-1 text-sm"
                aria-label="Pilih metrik"
              >
                <option value="netMargin">Net Margin</option>
                <option value="sales">Sales</option>
                <option value="cost">Cost</option>
                <option value="marginPct">Margin %</option>
              </select>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {rows.map((r) => {
                const value = r[chartMetric];
                const widthPct = (Math.abs(value) / maxMetric) * 100;
                return (
                  <div key={r.key} className="flex items-center gap-2">
                    <span className="w-28 shrink-0 truncate text-xs" title={r.label}>
                      {r.label}
                    </span>
                    <div className="flex flex-1 items-center gap-2">
                      <div className="h-5 flex-1 overflow-hidden rounded bg-muted">
                        <div
                          className="flex h-full items-center justify-end rounded bg-indigo-500 pr-1"
                          style={{ width: `${Math.max(widthPct, 8)}%` }}
                        >
                          <span className="text-[10px] font-medium text-white">{fmtMetric(value)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitCompareArrows className="h-5 w-5" />
            {mode === "project" ? "Perbandingan Antar Project" : "Perbandingan Antar Lokasi"}
          </CardTitle>
          <CardDescription>{rows.length} {mode === "project" ? "project" : "lokasi"} dibandingkan</CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Tidak ada data pada cakupan Anda.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <SortHeader label={mode === "project" ? "Project" : "Lokasi"} col="label" align="left" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <SortHeader label="Sales" col="sales" align="right" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <SortHeader label="Cost" col="cost" align="right" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <SortHeader label="Net Margin" col="netMargin" align="right" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <SortHeader label="Margin %" col="marginPct" align="right" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <SortHeader label="SLA" col="slaPct" align="right" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const expandable = mode === "location";
                    const isExpanded = expandable && expandedKey === r.key;
                    const site = expandable ? siteByLocation.get(r.key) : undefined;
                    return (
                      <Fragment key={r.key}>
                        <tr
                          onClick={expandable ? () => setExpandedKey((k) => (k === r.key ? null : r.key)) : undefined}
                          className={cn("border-b last:border-0", expandable && "cursor-pointer hover:bg-accent")}
                        >
                          <td className="py-2 pr-3">
                            <div className="flex items-center gap-1 font-medium">
                              {expandable && (
                                <ChevronRight
                                  className={cn("h-3.5 w-3.5 shrink-0 transition-transform", isExpanded && "rotate-90")}
                                />
                              )}
                              {r.label}
                            </div>
                            <div className="text-xs text-muted-foreground">{r.sub}</div>
                            <div className="mt-1 h-1.5 w-32 overflow-hidden rounded-full bg-muted">
                              <div className="h-full rounded-full bg-sky-500" style={{ width: `${(r.sales / maxSales) * 100}%` }} />
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">{formatCurrencyCompact(r.sales)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{formatCurrencyCompact(r.cost)}</td>
                          <td className="px-3 py-2 text-right tabular-nums font-medium">{formatCurrencyCompact(r.netMargin)}</td>
                          <td className="px-3 py-2 text-right">
                            <Badge variant={r.marginPct >= 50 ? "success" : r.marginPct >= 40 ? "warning" : "danger"}>
                              {r.marginPct.toFixed(1)}%
                            </Badge>
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">{r.slaPct.toFixed(1)}%</td>
                        </tr>
                        {isExpanded && site && (
                          <tr className="border-b bg-muted/30 last:border-0">
                            <td colSpan={6} className="px-3 py-3">
                              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                <ExpandStat label="Status Closing" value={site.closingStatus} />
                                <ExpandStat label="Cut-off" value={`${site.cutOffDaysLeft} hari lagi`} />
                                <ExpandStat label="Approval Pending" value={String(site.pendingApprovals)} />
                                <ExpandStat label="Invoice Overdue" value={String(site.overdueInvoices)} />
                              </div>
                              <div className="mt-3">
                                <p className="mb-1 text-xs text-muted-foreground">Aging piutang</p>
                                <div className="flex flex-wrap gap-2">
                                  {site.agingBuckets.map((b) => (
                                    <span key={b.bucket} className="rounded-md border px-2 py-1 text-xs">
                                      {b.bucket}: <b>{formatCurrencyCompact(b.amount)}</b>
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
