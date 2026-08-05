import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/activity/kpi-card";
import { HourlyTrendChart } from "@/components/activity/hourly-trend-chart";
import { SlaStageChart } from "@/components/activity/sla-stage-chart";
import { ActivityFeed } from "@/components/activity/activity-feed";
import { SiteActivityTable } from "@/components/activity/site-activity-table";
import {
  ACTIVITY_FEED,
  ACTIVITY_KPIS,
  HOURLY_TREND,
  SITE_ACTIVITY,
  SLA_STAGE_BARS,
} from "@/lib/mock/activity";
import { Download, RefreshCcw } from "lucide-react";

export default function ActivityDashboardPage() {
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
                <CardDescription>Sales vs Cost — akumulasi seluruh site hari ini.</CardDescription>
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
                <CardDescription>Ringkasan volume & kesehatan operasional per lokasi.</CardDescription>
              </div>
              <Button variant="ghost" size="sm">Lihat semua</Button>
            </CardHeader>
            <CardContent className="p-0">
              <SiteActivityTable rows={SITE_ACTIVITY} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>Live Activity</CardTitle>
                <CardDescription>Kejadian terbaru lintas project.</CardDescription>
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
              <ActivityFeed items={ACTIVITY_FEED} />
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
