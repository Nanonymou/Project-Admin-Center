"use client";

import { useMemo, useState } from "react";
import { notFound, useRouter } from "next/navigation";
import { ArrowLeft, CalendarRange, Download, Info, Lock, MapPin, RefreshCcw } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { ActivePeriodBadge } from "@/components/common/active-period-badge";
import { MarginSummaryCards, summarizeMargin } from "@/components/margin/margin-summary-cards";
import { ProfitBySiteChart } from "@/components/margin/profit-by-site-chart";
import { ProfitTrendChart } from "@/components/margin/profit-trend-chart";
import { LocationComparison } from "@/components/margin/location-comparison";
import { SitePeriodBar } from "@/components/site/site-period-bar";
import { buildProfitTrendForRange } from "@/lib/mock/margin-data";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePersona } from "@/components/providers/persona-provider";
import { useGlobalFilters } from "@/components/providers/global-filter-provider";
import { daysBetween, scaleSiteKpisByPeriod, SITE_KPI } from "@/lib/mock/site-kpi";
import { buildMarginBySite } from "@/lib/mock/margin-data";
import { getMarginModel, marginModelLabel } from "@/lib/mock/margin-model";
import { canAccessLocation } from "@/lib/personas";
import { PROJECT_OPTIONS } from "@/lib/mock/filters";
import { cn, formatCurrency } from "@/lib/utils";

export function ProjectMarginClient({ projectCode }: { projectCode: string }) {
  const { persona } = usePersona();
  const { filters, setFilters } = useGlobalFilters();
  const router = useRouter();

  const project = PROJECT_OPTIONS.find((p) => p.code.toLowerCase() === projectCode.toLowerCase());
  if (!project) notFound();

  const model = getMarginModel(project.code);

  // State-based filters local to this dashboard.
  const [locationFilter, setLocationFilter] = useState<string | "all">("all");

  // Locations available for this project within the persona's scope.
  const locationOptions = useMemo(
    () =>
      SITE_KPI.filter(
        (s) => s.projectCode === project.code && canAccessLocation(persona, s.locationId, s.projectCode),
      ).map((s) => ({ id: s.locationId, name: s.locationName })),
    [project.code, persona],
  );

  const sites = useMemo(() => {
    const rows = SITE_KPI.filter(
      (s) =>
        s.projectCode === project.code &&
        canAccessLocation(persona, s.locationId, s.projectCode) &&
        (locationFilter === "all" || s.locationId === locationFilter),
    );
    return scaleSiteKpisByPeriod(rows, filters.from, filters.to);
  }, [project.code, persona, locationFilter, filters.from, filters.to]);

  function applyPeriodPreset(days: number) {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - days);
    setFilters({ ...filters, from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) });
  }

  const bySite = useMemo(() => buildMarginBySite(sites), [sites]);
  const locationTotals = useMemo(() => {
    const salesSum = bySite.reduce((s, r) => s + r.sales, 0);
    const profitSum = bySite.reduce((s, r) => s + r.profit, 0);
    return { sales: salesSum, profit: profitSum, marginPct: salesSum > 0 ? (profitSum / salesSum) * 100 : 0 };
  }, [bySite]);
  const trend = useMemo(
    () => buildProfitTrendForRange(sites, filters.from, filters.to),
    [sites, filters.from, filters.to],
  );
  const trendInsight = useMemo(() => {
    if (trend.length === 0) return null;
    const avgMargin = trend.reduce((s, p) => s + p.marginPct, 0) / trend.length;
    const best = trend.reduce((a, b) => (b.profit > a.profit ? b : a));
    const worst = trend.reduce((a, b) => (b.profit < a.profit ? b : a));
    const delta = trend[trend.length - 1].marginPct - trend[0].marginPct;
    return { avgMargin, best, worst, delta };
  }, [trend]);
  const periodDays = daysBetween(filters.from, filters.to);
  const canExport = persona.capabilities.canExport;

  const noAccess = sites.length === 0;

  return (
    <div>
      <PageHeader
        title={`Dashboard Margin — ${project.name}`}
        description={`Analisis margin project ${project.code} · model ${marginModelLabel(model)}.`}
        breadcrumbs={[{ label: "Overview" }, { label: "Dashboard Margin" }, { label: project.code }]}
        actions={
          <>
            <ActivePeriodBadge />
            <Link href="/margin">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4" />
                Semua Project
              </Button>
            </Link>
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
        <PersonaBanner persona={persona} scopeSummary={`${project.code} · ${sites.length} location`} />

        <div className="flex items-start gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Model margin project ini: <b>{marginModelLabel(model)}</b>.
            {model === "per_location"
              ? " Margin dihitung & dilaporkan terpisah per location."
              : " Margin diagregasi di level project."}{" "}
            Periode {filters.from} → {filters.to} ({periodDays} hari).
          </span>
        </div>

        <SitePeriodBar scopedInfo={`${sites.length} location · ${project.code}`} />

        <div className="flex flex-wrap items-center gap-4 rounded-md border bg-card p-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              Lokasi
            </span>
            <select
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="all">Semua location</option>
              {locationOptions.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <CalendarRange className="h-3.5 w-3.5" />
              Periode
            </span>
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => applyPeriodPreset(d)}
                className={cn(
                  "rounded-md border px-2 py-1 text-[11px] font-medium transition-colors",
                  periodDays === d
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-background hover:bg-accent",
                )}
              >
                {d} hari
              </button>
            ))}
          </div>
        </div>

        {noAccess ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
              <Lock className="h-8 w-8 text-muted-foreground" />
              <div className="text-lg font-semibold">Tidak ada akses / data</div>
              <p className="max-w-md text-sm text-muted-foreground">
                Tidak ada location {project.code} dalam scope peran <b>{persona.roleLabel}</b>.
              </p>
              <Button variant="outline" size="sm" onClick={() => router.push("/margin")}>
                Kembali
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <MarginSummaryCards summary={summarizeMargin(sites)} />

            <Card>
              <CardHeader>
                <CardTitle>Tren Sales, Cost & Margin</CardTitle>
                <CardDescription>
                  Periode {filters.from} → {filters.to} · area = profit, garis = sales/cost, ungu =
                  margin % (aksis kanan).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <ProfitTrendChart data={trend} />
                {trendInsight && (
                  <div className="grid grid-cols-2 gap-2 border-t pt-3 sm:grid-cols-4">
                    <InsightTile label="Rata-rata Margin" value={`${trendInsight.avgMargin.toFixed(1)}%`} />
                    <InsightTile
                      label="Arah Margin"
                      value={`${trendInsight.delta >= 0 ? "▲" : "▼"} ${Math.abs(trendInsight.delta).toFixed(1)} pt`}
                      tone={trendInsight.delta >= 0 ? "text-emerald-700" : "text-rose-700"}
                    />
                    <InsightTile
                      label={`Profit Tertinggi (${trendInsight.best.month})`}
                      value={formatCurrency(trendInsight.best.profit)}
                    />
                    <InsightTile
                      label={`Profit Terendah (${trendInsight.worst.month})`}
                      value={formatCurrency(trendInsight.worst.profit)}
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {model === "per_location" && (
              <Card>
                <CardHeader>
                  <CardTitle>Margin per Location</CardTitle>
                  <CardDescription>
                    Setiap location dihitung independen sesuai model {marginModelLabel(model)}.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                          <th className="px-3 py-2 text-left font-medium">Location</th>
                          <th className="px-3 py-2 text-right font-medium">Sales</th>
                          <th className="px-3 py-2 text-right font-medium">Profit</th>
                          <th className="px-3 py-2 text-right font-medium">Margin %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bySite.map((s) => (
                          <tr key={s.locationId} className="border-b last:border-0 hover:bg-muted/30">
                            <td className="px-3 py-2">
                              <Link href={`/site/${s.locationId}`} className="font-medium text-primary hover:underline">
                                {s.label.split(" · ")[1] ?? s.label}
                              </Link>
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(s.sales)}</td>
                            <td className="px-3 py-2 text-right tabular-nums font-medium">{formatCurrency(s.profit)}</td>
                            <td className="px-3 py-2 text-right">
                              <Badge
                                variant={s.marginPct >= 55 ? "success" : s.marginPct >= 45 ? "warning" : "danger"}
                              >
                                {s.marginPct.toFixed(1)}%
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t bg-muted/30 text-sm font-semibold">
                          <td className="px-3 py-2">Total {project.code}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(locationTotals.sales)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(locationTotals.profit)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{locationTotals.marginPct.toFixed(1)}%</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {sites.length >= 2 && <LocationComparison sites={sites} />}

            <Card>
              <CardHeader>
                <CardTitle>Perbandingan Profit per Location</CardTitle>
                <CardDescription>Kontribusi profit tiap location {project.code}.</CardDescription>
              </CardHeader>
              <CardContent>
                <ProfitBySiteChart data={bySite} />
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

function InsightTile({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-md border bg-muted/20 p-2.5">
      <div className="truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn("mt-0.5 text-sm font-semibold tabular-nums", tone)}>{value}</div>
    </div>
  );
}
