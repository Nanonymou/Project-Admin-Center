"use client";

import { useMemo, useState } from "react";
import { GitCompareArrows, Building2, MapPin } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePersona } from "@/components/providers/persona-provider";
import { canAccessLocation } from "@/lib/personas";
import { cn, formatCurrencyCompact } from "@/lib/utils";
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
export function ComparisonClient() {
  const { persona } = usePersona();
  const [mode, setMode] = useState<CompareMode>("project");

  const scopedSites = useMemo(
    () => SITE_KPI.filter((s) => canAccessLocation(persona, s.locationId, s.projectCode)),
    [persona],
  );

  const rows = useMemo<CompareRow[]>(() => {
    if (mode === "location") {
      return scopedSites
        .map((s) => ({
          key: s.locationId,
          label: s.locationName,
          sub: s.projectCode,
          sales: s.sales,
          cost: s.cost,
          netMargin: s.sales - s.cost,
          marginPct: s.sales > 0 ? ((s.sales - s.cost) / s.sales) * 100 : 0,
          slaPct: s.slaPct,
          siteCount: 1,
        }))
        .sort((a, b) => b.netMargin - a.netMargin);
    }
    // Group by project.
    const byProject = new Map<string, typeof scopedSites>();
    for (const s of scopedSites) {
      byProject.set(s.projectCode, [...(byProject.get(s.projectCode) ?? []), s]);
    }
    return Array.from(byProject.entries())
      .map(([projectCode, sites]) => {
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
      })
      .sort((a, b) => b.netMargin - a.netMargin);
  }, [scopedSites, mode]);

  const maxSales = useMemo(() => Math.max(1, ...rows.map((r) => r.sales)), [rows]);

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
                    <th className="py-2 pr-3">{mode === "project" ? "Project" : "Lokasi"}</th>
                    <th className="px-3 py-2 text-right">Sales</th>
                    <th className="px-3 py-2 text-right">Cost</th>
                    <th className="px-3 py-2 text-right">Net Margin</th>
                    <th className="px-3 py-2 text-right">Margin %</th>
                    <th className="px-3 py-2 text-right">SLA</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.key} className="border-b last:border-0">
                      <td className="py-2 pr-3">
                        <div className="font-medium">{r.label}</div>
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
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
