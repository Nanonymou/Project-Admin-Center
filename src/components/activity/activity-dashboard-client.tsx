"use client";

import { useMemo, useState } from "react";
import { Download, RefreshCcw } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/activity/kpi-card";
import { HourlyTrendChart } from "@/components/activity/hourly-trend-chart";
import { SlaStageChart } from "@/components/activity/sla-stage-chart";
import { ActivityFeed } from "@/components/activity/activity-feed";
import { SiteActivityTable } from "@/components/activity/site-activity-table";
import { ActivityFilterBar } from "@/components/activity/activity-filter-bar";
import {
  ACTIVITY_FEED,
  ACTIVITY_KPIS,
  HOURLY_TREND,
  SITE_ACTIVITY,
  SLA_STAGE_BARS,
} from "@/lib/mock/activity";
import {
  DEFAULT_FILTER_STATE,
  LOCATION_OPTIONS,
  type ActivityFilterState,
} from "@/lib/mock/filters";

export function ActivityDashboardClient() {
  const [filters, setFilters] = useState<ActivityFilterState>(DEFAULT_FILTER_STATE);

  const selectedLocationNames = useMemo(
    () =>
      new Set(
        LOCATION_OPTIONS.filter((l) => filters.locations.includes(l.id)).map((l) => l.name),
      ),
    [filters.locations],
  );

  const filteredSites = useMemo(() => {
    return SITE_ACTIVITY.filter((row) => {
      if (filters.projects.length > 0 && !filters.projects.includes(row.project)) return false;
      if (filters.locations.length > 0 && !selectedLocationNames.has(row.location)) return false;
      return true;
    });
  }, [filters.projects, filters.locations, selectedLocationNames]);

  const filteredFeed = useMemo(() => {
    return ACTIVITY_FEED.filter((item) => {
      if (filters.projects.length > 0 && !filters.projects.includes(item.project)) return false;
      if (filters.locations.length > 0 && !selectedLocationNames.has(item.location)) return false;
      return true;
    });
  }, [filters.projects, filters.locations, selectedLocationNames]);

  const scopeLabel = useMemo(() => {
    const p = filters.projects.length === 0 ? "Semua project" : filters.projects.join(", ");
    const l = filters.locations.length === 0 ? "semua location" : `${filters.locations.length} location`;
    return `${p} · ${l}`;
  }, [filters.projects, filters.locations]);

  return (
    <div>
      <PageHeader
        title="Activity Dashboard"
        description="Ringkasan aktivitas operasional multi-site secara real-time — transaksi, SLA, dan status approval."
        breadcrumbs={[
          { label: "Overview" },
          { label: "Activity Dashboard" },
        ]}
        actions={
          <>
            <Button variant="outline" size="sm">
              <RefreshCcw className="h-4 w-4" />
              Refresh
            </Button>
            <Button size="sm">
              <Download className="h-4 w-4" />
              Export
            </Button>
          </>
        }
      />

      <div className="space-y-6 p-4 md:p-6">
        <ActivityFilterBar
          value={filters}
          onChange={setFilters}
          onReset={() => setFilters(DEFAULT_FILTER_STATE)}
          matchedCount={filteredSites.length}
        />

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {ACTIVITY_KPIS.map((kpi) => (
            <KpiCard key={kpi.key} kpi={kpi} />
          ))}
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle>Transaksi per Jam</CardTitle>
                <CardDescription>
                  Sales vs Cost — {scopeLabel} · {filters.from} → {filters.to}
                </CardDescription>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-primary" /> Sales
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-amber-500" /> Cost
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <HourlyTrendChart data={HOURLY_TREND} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>SLA per Tahap</CardTitle>
              <CardDescription>Status invoice per stage approval.</CardDescription>
            </CardHeader>
            <CardContent>
              <SlaStageChart data={SLA_STAGE_BARS} />
            </CardContent>
          </Card>
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>Aktivitas per Site</CardTitle>
                <CardDescription>
                  {filteredSites.length === SITE_ACTIVITY.length
                    ? "Ringkasan volume & kesehatan operasional per lokasi."
                    : `Menampilkan ${filteredSites.length} dari ${SITE_ACTIVITY.length} site sesuai filter.`}
                </CardDescription>
              </div>
              <Button variant="ghost" size="sm">Lihat semua</Button>
            </CardHeader>
            <CardContent className="p-0">
              {filteredSites.length > 0 ? (
                <SiteActivityTable rows={filteredSites} />
              ) : (
                <EmptyState label="Tidak ada site cocok dengan filter aktif." />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>Live Activity</CardTitle>
                <CardDescription>
                  {filteredFeed.length === ACTIVITY_FEED.length
                    ? "Kejadian terbaru lintas project."
                    : `${filteredFeed.length} kejadian sesuai filter.`}
                </CardDescription>
              </div>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-600">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                Live
              </span>
            </CardHeader>
            <CardContent className="pt-0">
              {filteredFeed.length > 0 ? (
                <ActivityFeed items={filteredFeed} />
              ) : (
                <EmptyState label="Belum ada aktivitas untuk filter ini." />
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex h-40 items-center justify-center px-6 text-center text-sm text-muted-foreground">
      {label}
    </div>
  );
}
