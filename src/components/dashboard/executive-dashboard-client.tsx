"use client";

import { useMemo, useState } from "react";
import { Download, Lock, RefreshCcw } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { PortfolioSummary } from "@/components/dashboard/portfolio-summary";
import { SiteCard, SiteCardEmpty } from "@/components/dashboard/site-card";
import { SiteComparisonChart } from "@/components/dashboard/site-comparison-chart";
import { AgingDonut } from "@/components/dashboard/aging-donut";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { usePersona } from "@/components/providers/persona-provider";
import { aggregateAging, aggregateTotals, SITE_KPI } from "@/lib/mock/site-kpi";
import { canAccessLocation } from "@/lib/personas";
import { cn } from "@/lib/utils";
import { PROJECT_OPTIONS } from "@/lib/mock/filters";

type SortKey = "sales" | "marginPct" | "slaPct" | "overdueInvoices";

const SORT_LABEL: Record<SortKey, string> = {
  sales: "Sales tertinggi",
  marginPct: "Margin tertinggi",
  slaPct: "SLA tertinggi",
  overdueInvoices: "Overdue terbanyak",
};

export function ExecutiveDashboardClient() {
  const { persona } = usePersona();
  const [sortKey, setSortKey] = useState<SortKey>("sales");

  const scopedSites = useMemo(
    () => SITE_KPI.filter((s) => canAccessLocation(persona, s.locationId, s.projectCode)),
    [persona],
  );

  const sortedSites = useMemo(() => {
    const rows = [...scopedSites];
    rows.sort((a, b) => (b[sortKey] as number) - (a[sortKey] as number));
    return rows;
  }, [scopedSites, sortKey]);

  const totals = useMemo(() => aggregateTotals(scopedSites), [scopedSites]);
  const aging = useMemo(() => aggregateAging(scopedSites), [scopedSites]);

  const scopeSummary = useMemo(() => {
    if (persona.scope.projects.length === 0 && persona.scope.locations.length === 0)
      return "Semua project & location";
    const projList =
      persona.scope.projects.length === 0
        ? PROJECT_OPTIONS.map((p) => p.code).join(", ")
        : persona.scope.projects.join(", ");
    if (persona.scope.locations.length === 0) return `${projList} · semua location`;
    const locNames = SITE_KPI.filter((s) => persona.scope.locations.includes(s.locationId))
      .map((s) => s.locationName)
      .join(", ");
    return `${projList} · ${locNames}`;
  }, [persona]);

  const canExport = persona.capabilities.canExport;

  return (
    <div>
      <PageHeader
        title="Executive Dashboard"
        description="Agregasi KPI seluruh site: performa finansial, SLA, dan status closing dalam satu pandangan."
        breadcrumbs={[{ label: "Overview" }, { label: "Executive Dashboard" }]}
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
        <PersonaBanner persona={persona} scopeSummary={scopeSummary} />

        <PortfolioSummary totals={totals} />

        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">KPI per Site</h2>
              <p className="text-sm text-muted-foreground">
                {scopedSites.length === 0
                  ? "Tidak ada site dalam scope Anda."
                  : `${scopedSites.length} site aktif · klik "Open Workspace" untuk masuk ke lokasi.`}
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-muted-foreground">Urut:</span>
              {(Object.keys(SORT_LABEL) as SortKey[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSortKey(key)}
                  className={cn(
                    "rounded-md border px-2 py-1 text-xs font-medium",
                    sortKey === key
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-background hover:bg-accent",
                  )}
                >
                  {SORT_LABEL[key]}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {sortedSites.length === 0 && <SiteCardEmpty />}
            {sortedSites.map((site) => (
              <SiteCard key={site.locationId} site={site} />
            ))}
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Perbandingan Sales / Cost / Margin per Site</CardTitle>
              <CardDescription>
                Data akumulasi periode berjalan — nilai dalam miliar rupiah.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {scopedSites.length > 0 ? (
                <SiteComparisonChart sites={sortedSites} />
              ) : (
                <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
                  Tidak ada site dalam scope.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Invoice Aging Portfolio</CardTitle>
              <CardDescription>Distribusi outstanding invoice per bucket umur.</CardDescription>
            </CardHeader>
            <CardContent>
              {aging.some((a) => a.amount > 0) ? (
                <AgingDonut data={aging} />
              ) : (
                <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
                  Tidak ada outstanding invoice untuk ditampilkan.
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
