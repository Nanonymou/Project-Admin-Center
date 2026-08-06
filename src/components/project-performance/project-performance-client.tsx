"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Building2, ChevronDown, ChevronUp, Trophy } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { KpiCard } from "@/components/common/kpi-card";
import { ActivePeriodBadge } from "@/components/common/active-period-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePersona } from "@/components/providers/persona-provider";
import { useGlobalFilters } from "@/components/providers/global-filter-provider";
import { PROJECT_OPTIONS, LOCATION_OPTIONS } from "@/lib/mock/filters";
import { canAccessLocation } from "@/lib/personas";
import { scaleSiteKpisByPeriod, SITE_KPI } from "@/lib/mock/site-kpi";
import { cn, formatCurrency } from "@/lib/utils";

type ProjectRow = {
  code: string;
  name: string;
  sites: number;
  sales: number;
  cost: number;
  profit: number;
  marginPct: number;
  avgSla: number;
  overdue: number;
  pending: number;
};

export function ProjectPerformanceClient() {
  const { persona } = usePersona();
  const { filters, setFilters } = useGlobalFilters();

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

  const filteredSites = useMemo(() => {
    const rows = scopedSites.filter((s) => {
      if (filters.projects.length > 0 && !filters.projects.includes(s.projectCode)) return false;
      if (filters.locations.length > 0 && !selectedLocationIds.has(s.locationId)) return false;
      return true;
    });
    return scaleSiteKpisByPeriod(rows, filters.from, filters.to);
  }, [scopedSites, filters.projects, filters.locations, filters.from, filters.to, selectedLocationIds]);

  const ranked = useMemo<ProjectRow[]>(() => {
    const map = new Map<string, ProjectRow & { slaSum: number }>();
    for (const s of filteredSites) {
      const entry =
        map.get(s.projectCode) ??
        ({
          code: s.projectCode,
          name: s.projectName,
          sites: 0,
          sales: 0,
          cost: 0,
          profit: 0,
          marginPct: 0,
          avgSla: 0,
          overdue: 0,
          pending: 0,
          slaSum: 0,
        } as ProjectRow & { slaSum: number });
      entry.sites += 1;
      entry.sales += s.sales;
      entry.cost += s.cost;
      entry.profit += s.sales - s.cost;
      entry.slaSum += s.slaPct;
      entry.overdue += s.overdueInvoices;
      entry.pending += s.pendingApprovals;
      map.set(s.projectCode, entry);
    }
    return Array.from(map.values())
      .map((e) => ({
        ...e,
        marginPct: e.sales > 0 ? (e.profit / e.sales) * 100 : 0,
        avgSla: e.sites > 0 ? e.slaSum / e.sites : 0,
      }))
      .sort((a, b) => b.profit - a.profit);
  }, [filteredSites]);

  // Column sorting.
  type SortKey = "sites" | "sales" | "profit" | "marginPct" | "avgSla" | "overdue";
  const [sortKey, setSortKey] = useState<SortKey>("profit");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const sorted = useMemo(() => {
    const arr = [...ranked];
    arr.sort((a, b) => (sortDir === "asc" ? a[sortKey] - b[sortKey] : b[sortKey] - a[sortKey]));
    return arr;
  }, [ranked, sortKey, sortDir]);

  const totals = useMemo(
    () => ({
      projects: ranked.length,
      sales: ranked.reduce((s, r) => s + r.sales, 0),
      profit: ranked.reduce((s, r) => s + r.profit, 0),
      bestMargin: ranked.reduce((best, r) => (r.marginPct > (best?.marginPct ?? -1) ? r : best), ranked[0]),
    }),
    [ranked],
  );

  const medal = ["🥇", "🥈", "🥉"];

  return (
    <div>
      <PageHeader
        title="Peringkat Performa Project"
        description="Ranking project berdasarkan profit, margin, dan kepatuhan SLA — agregat seluruh site dalam scope."
        breadcrumbs={[{ label: "Overview" }, { label: "Project Performance" }]}
        actions={<ActivePeriodBadge />}
      />

      <div className="space-y-6 p-4 md:p-6">
        <PersonaBanner persona={persona} scopeSummary={`${scopedSites.length} site accessible`} />

        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiCard label="Project" value={totals.projects} format="number" icon={Building2} tone="primary" />
          <KpiCard label="Total Sales" value={totals.sales} format="currency-compact" icon={Trophy} tone="info" />
          <KpiCard label="Total Profit" value={totals.profit} format="currency-compact" icon={Trophy} tone="success" />
          <KpiCard
            label="Margin Terbaik"
            value={totals.bestMargin ? `${totals.bestMargin.code} ${totals.bestMargin.marginPct.toFixed(1)}%` : "—"}
            format="text"
            icon={Trophy}
            tone="warning"
          />
        </section>

        <Card>
          <CardHeader>
            <CardTitle>Tabel Peringkat Project</CardTitle>
            <CardDescription>Diurutkan berdasarkan total profit periode aktif.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2 text-left font-medium">#</th>
                    <th className="px-3 py-2 text-left font-medium">Project</th>
                    <SortHeader label="Site" col="sites" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <SortHeader label="Sales" col="sales" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <SortHeader label="Profit" col="profit" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <SortHeader label="Margin %" col="marginPct" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <SortHeader label="SLA" col="avgSla" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <SortHeader label="Overdue" col="overdue" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <th className="px-3 py-2 text-right font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-sm text-muted-foreground">
                        Tidak ada project dalam scope & filter ini.
                      </td>
                    </tr>
                  )}
                  {sorted.map((r, i) => (
                    <tr key={r.code} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-3 py-2 text-lg">{medal[i] ?? <span className="text-sm text-muted-foreground">{i + 1}</span>}</td>
                      <td className="px-3 py-2">
                        <div className="font-medium">{r.code}</div>
                        <div className="text-[11px] text-muted-foreground">{r.name}</div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {r.marginPct < 45 && (
                            <Badge variant="danger" className="h-4 px-1 text-[9px]">Margin Rendah</Badge>
                          )}
                          {r.avgSla < 90 && (
                            <Badge variant="warning" className="h-4 px-1 text-[9px]">SLA Rendah</Badge>
                          )}
                          {r.overdue > 0 && (
                            <Badge variant="danger" className="h-4 px-1 text-[9px]">{r.overdue} Overdue</Badge>
                          )}
                          {r.marginPct >= 55 && r.avgSla >= 95 && r.overdue === 0 && (
                            <Badge variant="success" className="h-4 px-1 text-[9px]">Sehat</Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.sites}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(r.sales)}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium">{formatCurrency(r.profit)}</td>
                      <td className="px-3 py-2 text-right">
                        <Badge variant={r.marginPct >= 55 ? "success" : r.marginPct >= 45 ? "warning" : "danger"}>
                          {r.marginPct.toFixed(1)}%
                        </Badge>
                      </td>
                      <td className={cn("px-3 py-2 text-right tabular-nums", r.avgSla < 90 && "text-amber-700")}>
                        {r.avgSla.toFixed(0)}%
                      </td>
                      <td className={cn("px-3 py-2 text-right tabular-nums", r.overdue > 0 && "text-rose-600")}>
                        {r.overdue}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Link
                          href={`/margin/${r.code}`}
                          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                        >
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
      </div>
    </div>
  );
}

function SortHeader<K extends string>({
  label,
  col,
  sortKey,
  sortDir,
  onSort,
}: {
  label: string;
  col: K;
  sortKey: K;
  sortDir: "asc" | "desc";
  onSort: (col: K) => void;
}) {
  const active = sortKey === col;
  return (
    <th className="px-3 py-2 text-right font-medium">
      <button
        type="button"
        onClick={() => onSort(col)}
        className={cn(
          "inline-flex items-center gap-0.5 hover:text-foreground",
          active && "text-foreground",
        )}
      >
        {label}
        {active ? (
          sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronDown className="h-3 w-3 opacity-30" />
        )}
      </button>
    </th>
  );
}
