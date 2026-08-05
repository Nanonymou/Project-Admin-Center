"use client";

import { useMemo, useState } from "react";
import { notFound, useRouter } from "next/navigation";
import { Building2, ChevronRight, Download, Lock, RefreshCcw } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SalesCostChart } from "@/components/site/sales-cost-chart";
import { CategoryDonut } from "@/components/site/category-donut";
import { MarginTrendChart } from "@/components/site/margin-trend-chart";
import { InvoiceStatusPanel } from "@/components/site/invoice-status-panel";
import { usePersona } from "@/components/providers/persona-provider";
import { getSiteDetail, SITE_DETAILS } from "@/lib/mock/site-detail";
import { canAccessLocation } from "@/lib/personas";
import { cn, formatCurrency, formatNumber } from "@/lib/utils";

export function SiteDashboardClient({ locationId }: { locationId: string }) {
  const { persona } = usePersona();
  const router = useRouter();
  const [range, setRange] = useState<"7d" | "30d">("30d");

  const detail = getSiteDetail(locationId);
  if (!detail) notFound();

  const inScope = canAccessLocation(persona, detail.site.locationId, detail.site.projectCode);

  const dailyView = useMemo(
    () => (range === "7d" ? detail.daily30d.slice(-7) : detail.daily30d),
    [range, detail.daily30d],
  );

  const accessibleSites = Object.values(SITE_DETAILS)
    .map((d) => d.site)
    .filter((s) => canAccessLocation(persona, s.locationId, s.projectCode));

  const canExport = persona.capabilities.canExport;

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

        <SiteSummaryStrip detail={detail} />

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
            <CardHeader className="flex flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle>1. Sales · Cost · Profit</CardTitle>
                <CardDescription>
                  Toggle seri, focus mode, mode harian/kumulatif, & brush untuk zoom rentang tanggal.
                </CardDescription>
              </div>
              <div className="flex gap-1.5">
                {(["7d", "30d"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRange(r)}
                    className={cn(
                      "rounded-md border px-2 py-1 text-xs font-medium",
                      range === r
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input bg-background hover:bg-accent",
                    )}
                  >
                    {r === "7d" ? "7 hari" : "30 hari"}
                  </button>
                ))}
              </div>
            </CardHeader>
            <CardContent>
              <SalesCostChart data={dailyView} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>2. Komposisi Service Category</CardTitle>
              <CardDescription>
                Hover slice / list untuk highlight · kategori aktif per site.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CategoryDonut data={detail.categories} />
            </CardContent>
          </Card>
        </section>

        <section>
          <Card>
            <CardHeader>
              <CardTitle>3. Tren Margin 12 Bulan</CardTitle>
              <CardDescription>
                Bar = margin bulanan, garis = tren, target dashed = 50%.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <MarginTrendChart data={detail.marginTrend} />
            </CardContent>
          </Card>
        </section>

        <section>
          <InvoiceStatusPanel
            stages={detail.approvalStages}
            aging={detail.invoiceAging}
            invoices={detail.invoices}
          />
        </section>
      </div>
    </div>
  );
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
