"use client";

import { useMemo } from "react";
import { notFound, useRouter } from "next/navigation";
import { Building2, ChevronRight, Download, Info, Lock, RefreshCcw } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SalesCostChart } from "@/components/site/sales-cost-chart";
import { CategoryDonut } from "@/components/site/category-donut";
import { MarginTrendChart } from "@/components/site/margin-trend-chart";
import { InvoiceStatusPanel } from "@/components/site/invoice-status-panel";
import { SitePeriodBar } from "@/components/site/site-period-bar";
import { ReminderWidget } from "@/components/site/reminder-widget";
import { buildReminders } from "@/lib/mock/reminders";
import { DeadlineList } from "@/components/reminders/deadline-list";
import { buildDeadlines } from "@/lib/mock/deadlines";
import { ApprovalReminderList } from "@/components/reminders/approval-reminder-list";
import { buildApprovalReminders } from "@/lib/mock/approvals";
import { OverdueInvoiceList } from "@/components/reminders/overdue-invoice-list";
import { buildOverdueInvoicesFor } from "@/lib/mock/overdue-invoices";
import { RecentActivityList } from "@/components/reminders/recent-activity-list";
import { usePersona } from "@/components/providers/persona-provider";
import { useGlobalFilters } from "@/components/providers/global-filter-provider";
import {
  getSiteDetail,
  SITE_DETAILS,
  type MockInvoice,
  type SiteApprovalStage,
  type SiteCategoryPoint,
  type SiteDaily,
  type SiteInvoiceAging,
  type SiteMarginPoint,
} from "@/lib/mock/site-detail";
import { canAccessLocation } from "@/lib/personas";
import { cn, formatCurrency, formatNumber } from "@/lib/utils";

function withinRange(iso: string, from: string, to: string) {
  return iso >= from && iso <= to;
}

export function SiteDashboardClient({ locationId }: { locationId: string }) {
  const { persona } = usePersona();
  const { filters } = useGlobalFilters();
  const router = useRouter();

  const detail = getSiteDetail(locationId);
  if (!detail) notFound();

  const inScope = canAccessLocation(persona, detail.site.locationId, detail.site.projectCode);

  const reminders = useMemo(() => buildReminders(detail.site), [detail.site]);
  const deadlines = useMemo(() => buildDeadlines([detail.site]), [detail.site]);
  const approvals = useMemo(() => buildApprovalReminders(detail.site, detail), [detail]);
  const overdueInvoices = useMemo(
    () => buildOverdueInvoicesFor([detail.site], SITE_DETAILS),
    [detail.site],
  );

  const scopedDaily: SiteDaily[] = useMemo(
    () => detail.daily30d.filter((d) => withinRange(d.iso, filters.from, filters.to)),
    [detail.daily30d, filters.from, filters.to],
  );

  const scopedMargin: SiteMarginPoint[] = useMemo(
    () => detail.marginTrend.filter((m) => withinRange(m.iso, monthStart(filters.from), filters.to)),
    [detail.marginTrend, filters.from, filters.to],
  );

  // Categories, aging, invoices don't have per-day timestamps; scale them
  // proportionally to the selected period vs the 30d baseline so charts
  // still respond visually to the global period.
  const factor = useMemo(() => computePeriodFactor(scopedDaily.length, detail.daily30d.length), [
    scopedDaily.length,
    detail.daily30d.length,
  ]);
  const scaledCategories: SiteCategoryPoint[] = useMemo(
    () => detail.categories.map((c) => ({ ...c, amount: Math.round(c.amount * factor) })),
    [detail.categories, factor],
  );
  const scaledStages: SiteApprovalStage[] = useMemo(
    () =>
      detail.approvalStages.map((s) => ({
        ...s,
        onTime: Math.round(s.onTime * factor),
        atRisk: Math.round(s.atRisk * factor),
        overdue: Math.round(s.overdue * factor),
      })),
    [detail.approvalStages, factor],
  );
  const scaledAging: SiteInvoiceAging[] = useMemo(
    () =>
      detail.invoiceAging.map((a) => ({
        ...a,
        count: Math.round(a.count * factor),
        amount: Math.round(a.amount * factor),
      })),
    [detail.invoiceAging, factor],
  );
  const scaledInvoices: MockInvoice[] = useMemo(
    () => detail.invoices.slice(0, Math.max(1, Math.round(detail.invoices.length * factor))),
    [detail.invoices, factor],
  );

  const accessibleSites = Object.values(SITE_DETAILS)
    .map((d) => d.site)
    .filter((s) => canAccessLocation(persona, s.locationId, s.projectCode));

  const canExport = persona.capabilities.canExport;
  const periodOutside = scopedDaily.length === 0;

  if (!inScope) {
    return (
      <div className="p-8">
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <Lock className="h-8 w-8 text-muted-foreground" />
            <div className="text-lg font-semibold">Akses Ditolak</div>
            <p className="max-w-md text-sm text-muted-foreground">
              Site <b>{detail.site.projectCode} · {detail.site.locationName}</b> berada di luar
              scope peran <b>{persona.roleLabel}</b>.
            </p>
            <Button variant="outline" size="sm" onClick={() => router.push("/dashboard")}>
              Kembali ke Executive Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={`${detail.site.projectName} · ${detail.site.locationName}`}
        description={`Site Dashboard — periode invoice ${detail.site.invoicePeriod} · cut-off ${
          detail.site.cutOffDaysLeft > 0 ? `H-${detail.site.cutOffDaysLeft}` : "hari ini"
        }`}
        breadcrumbs={[
          { label: "Overview" },
          { label: "Site Dashboard" },
          { label: detail.site.locationName },
        ]}
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
        <PersonaBanner persona={persona} scopeSummary={`${accessibleSites.length} site accessible`} />

        <SitePeriodBar
          scopedInfo={`${scopedDaily.length} hari data · ${scaledInvoices.length} invoice`}
        />

        {periodOutside && (
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Rentang <b>{filters.from} → {filters.to}</b> di luar 30 hari data mock —
              grafik ditampilkan kosong. Coba preset <b>7 hari</b> atau <b>30 hari</b>.
            </span>
          </div>
        )}

        <SiteSummaryStrip detail={detail} />

        <section>
          <ReminderWidget items={reminders} />
        </section>

        <section>
          <Card>
            <CardHeader>
              <CardTitle>Deadline Reminder</CardTitle>
              <CardDescription>
                Semua tenggat aktif untuk site ini — dikelompokkan per status.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DeadlineList items={deadlines} showLocationColumn={false} />
            </CardContent>
          </Card>
        </section>

        <section>
          <Card>
            <CardHeader>
              <CardTitle>Approval Reminder</CardTitle>
              <CardDescription>
                Invoice yang menunggu tindakan approval — filter status, prioritas, dan approve inline.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ApprovalReminderList
                items={approvals}
                showLocationColumn={false}
                compact
              />
            </CardContent>
          </Card>
        </section>

        <section>
          <Card>
            <CardHeader>
              <CardTitle>Invoice Terlambat</CardTitle>
              <CardDescription>
                Invoice overdue site ini — kelompok severity + reminder cepat.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <OverdueInvoiceList items={overdueInvoices} showLocationColumn={false} />
            </CardContent>
          </Card>
        </section>

        <section>
          <Card>
            <CardHeader>
              <CardTitle>Aktivitas Terbaru</CardTitle>
              <CardDescription>
                Kejadian terbaru untuk {detail.site.projectCode} · {detail.site.locationName}.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RecentActivityList
                locationName={detail.site.locationName}
                showLocationChip={false}
              />
            </CardContent>
          </Card>
        </section>

        {accessibleSites.length > 1 && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">Pindah site:</span>
            {accessibleSites.map((s) => {
              const active = s.locationId === locationId;
              return (
                <button
                  key={s.locationId}
                  type="button"
                  onClick={() => router.push(`/site/${s.locationId}`)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-background hover:bg-accent",
                  )}
                >
                  {s.projectCode} · {s.locationName}
                  {!active && <ChevronRight className="h-3 w-3" />}
                </button>
              );
            })}
          </div>
        )}

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>1. Sales · Cost · Profit</CardTitle>
              <CardDescription>
                Toggle seri, focus mode, harian/kumulatif, brush zoom. Data mengikuti periode global.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {scopedDaily.length > 0 ? (
                <SalesCostChart data={scopedDaily} />
              ) : (
                <EmptyRange />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>2. Komposisi Service Category</CardTitle>
              <CardDescription>
                Nilai diskalakan proporsional dengan periode global.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {scopedDaily.length > 0 ? (
                <CategoryDonut data={scaledCategories} />
              ) : (
                <EmptyRange />
              )}
            </CardContent>
          </Card>
        </section>

        <section>
          <Card>
            <CardHeader>
              <CardTitle>3. Tren Margin</CardTitle>
              <CardDescription>
                Menampilkan bulan yang tercakup dalam periode global — bar bulanan, garis tren, target 50%.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {scopedMargin.length > 0 ? (
                <MarginTrendChart data={scopedMargin} />
              ) : (
                <EmptyRange />
              )}
            </CardContent>
          </Card>
        </section>

        <section>
          <InvoiceStatusPanel
            stages={scaledStages}
            aging={scaledAging}
            invoices={scaledInvoices}
          />
        </section>
      </div>
    </div>
  );
}

function EmptyRange() {
  return (
    <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
      Tidak ada data untuk periode terpilih.
    </div>
  );
}

function computePeriodFactor(rangeDays: number, baseDays: number) {
  if (rangeDays === 0 || baseDays === 0) return 0;
  const raw = rangeDays / baseDays;
  return Math.max(0.05, Math.min(1, raw));
}

function monthStart(iso: string) {
  return `${iso.slice(0, 7)}-01`;
}

function SiteSummaryStrip({ detail }: { detail: ReturnType<typeof getSiteDetail> & object }) {
  const s = detail.site;
  const statusTone =
    s.slaPct >= 90
      ? "success"
      : s.slaPct >= 80
        ? "warning"
        : "danger";
  const items = [
    { label: "Sales (MTD)", value: formatCurrency(s.sales) },
    { label: "Cost (MTD)", value: formatCurrency(s.cost) },
    { label: "Net Margin", value: formatCurrency(s.netMargin), hint: `${s.marginPct.toFixed(1)}%` },
    { label: "SLA", value: `${s.slaPct}%` },
    { label: "Pending Approvals", value: formatNumber(s.pendingApprovals) },
    { label: "Invoice Overdue", value: formatNumber(s.overdueInvoices) },
  ];
  return (
    <Card>
      <CardContent className="grid grid-cols-2 divide-x divide-y p-0 sm:grid-cols-3 lg:grid-cols-6">
        {items.map((item) => (
          <div key={item.label} className="p-4">
            <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {item.label}
            </div>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span className="text-base font-semibold tabular-nums">{item.value}</span>
              {"hint" in item && item.hint && (
                <span className="text-xs text-muted-foreground tabular-nums">{item.hint}</span>
              )}
            </div>
          </div>
        ))}
      </CardContent>
      <div className="border-t px-4 py-2 text-xs">
        <span className="text-muted-foreground">Status site:</span>{" "}
        <Badge variant={statusTone}>
          {s.slaPct >= 90 ? "Healthy" : s.slaPct >= 80 ? "Watch" : "Critical"}
        </Badge>
      </div>
    </Card>
  );
}
