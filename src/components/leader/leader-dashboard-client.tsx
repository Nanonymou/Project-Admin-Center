"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  ClipboardList,
  Download,
  FileText,
  Info,
  Lock,
  RefreshCcw,
  Trophy,
} from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { ActivityFilterBar } from "@/components/activity/activity-filter-bar";
import { ProfitContributionChart } from "@/components/leader/profit-contribution-chart";
import { ProfitRankingTable } from "@/components/leader/profit-ranking-table";
import { DeadlineList } from "@/components/reminders/deadline-list";
import { buildDeadlines } from "@/lib/mock/deadlines";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePersona } from "@/components/providers/persona-provider";
import { useGlobalFilters } from "@/components/providers/global-filter-provider";
import { aggregateTotals, SITE_KPI, type SiteKpi } from "@/lib/mock/site-kpi";
import { LOCATION_OPTIONS, PROJECT_OPTIONS } from "@/lib/mock/filters";
import { canAccessLocation } from "@/lib/personas";
import { cn, formatCurrency, formatNumber } from "@/lib/utils";

export function LeaderDashboardClient() {
  const { persona } = usePersona();
  const { filters, setFilters, reset } = useGlobalFilters();

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
    return scopedSites.filter((s) => {
      if (filters.projects.length > 0 && !filters.projects.includes(s.projectCode)) return false;
      if (filters.locations.length > 0 && !selectedLocationIds.has(s.locationId)) return false;
      return true;
    });
  }, [scopedSites, filters.projects, filters.locations, selectedLocationIds]);

  const totals = useMemo(() => aggregateTotals(filteredSites), [filteredSites]);

  const rankedByProfit = useMemo(
    () => [...filteredSites].sort((a, b) => b.netMargin - a.netMargin),
    [filteredSites],
  );
  const top = rankedByProfit.slice(0, 3);
  const bottom = rankedByProfit.slice(-3).reverse();

  const deadlines = useMemo(() => buildDeadlines(filteredSites), [filteredSites]);

  const pendingAll = filteredSites.reduce((s, x) => s + x.pendingApprovals, 0);
  const overdueAll = filteredSites.reduce((s, x) => s + x.overdueInvoices, 0);
  const totalContribution = totals.netMargin || 1;

  const canExport = persona.capabilities.canExport;

  return (
    <div>
      <PageHeader
        title="Dashboard Leader"
        description="Profit-first view — kontribusi profit per site, ranking, dan queue approval yang perlu tindakan Leader."
        breadcrumbs={[{ label: "Overview" }, { label: "Dashboard Leader" }]}
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
        <PersonaBanner persona={persona} scopeSummary={`${scopedSites.length} site accessible`} />

        <div className="flex items-start gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Filter global aktif — pilihan tanggal, project, dan location sinkron dengan halaman
            Activity, Ranking, dan Site Dashboard.
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

        <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <LeaderStat label="Total Profit" value={formatCurrency(totals.netMargin)} hint={`${totals.marginPct.toFixed(1)}% GP`} tone="success" />
          <LeaderStat label="Total Sales" value={formatCurrency(totals.sales)} hint={`${filteredSites.length} site`} tone="primary" />
          <LeaderStat label="Approval Pending" value={formatNumber(pendingAll)} hint="butuh review Leader" tone="warning" actionHref="/activity" />
          <LeaderStat label="Invoice Overdue" value={formatNumber(overdueAll)} hint="escalation aktif" tone={overdueAll > 0 ? "danger" : "muted"} />
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-amber-500" />
                  Ranking Site Berdasarkan Profit
                </CardTitle>
                <CardDescription>
                  Top & bottom 3 sesuai scope — Leader dapat langsung drill ke Site Dashboard.
                </CardDescription>
              </div>
              <Link
                href="/ranking"
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                Ranking lengkap
                <ArrowRight className="h-3 w-3" />
              </Link>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <RankingBlock title="Top 3" tone="success" sites={top} totalContribution={totalContribution} />
              {rankedByProfit.length > 3 && (
                <RankingBlock title="Bottom 3" tone="warning" sites={bottom} totalContribution={totalContribution} />
              )}
              {rankedByProfit.length === 0 && (
                <div className="col-span-full py-10 text-center text-sm text-muted-foreground">
                  Tidak ada site sesuai filter.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Kontribusi Profit</CardTitle>
              <CardDescription>Share margin bersih tiap site terhadap portfolio.</CardDescription>
            </CardHeader>
            <CardContent>
              {filteredSites.length > 0 ? (
                <ProfitContributionChart sites={rankedByProfit} />
              ) : (
                <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
                  Tidak ada data.
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <section>
          <Card>
            <CardHeader>
              <CardTitle>Deadline Portfolio</CardTitle>
              <CardDescription>
                Semua tenggat lintas site dalam scope Leader — dikelompokkan per status.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DeadlineList items={deadlines} />
            </CardContent>
          </Card>
        </section>

        <section>
          <Card>
            <CardHeader className="flex flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-amber-500" />
                  Tabel Peringkat Profit
                </CardTitle>
                <CardDescription>
                  Klik kolom header untuk sort. Kontribusi = share margin bersih terhadap total portfolio.
                </CardDescription>
              </div>
              <Link
                href="/ranking"
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                Ke halaman Ranking
                <ArrowRight className="h-3 w-3" />
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              <ProfitRankingTable sites={filteredSites} />
            </CardContent>
          </Card>
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <BadgeCheck className="h-4 w-4 text-primary" />
                  Antrian Approval
                </CardTitle>
                <CardDescription>Pending review Leader per site.</CardDescription>
              </div>
              <span className="text-xs text-muted-foreground">Total: {pendingAll}</span>
            </CardHeader>
            <CardContent className="p-0">
              <PendingApprovalList sites={filteredSites} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-primary" />
                Aksi Cepat Leader
              </CardTitle>
              <CardDescription>
                Shortcut ke aktivitas paling sering dilakukan Leader Admin.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <QuickAction href="/activity" label="Review Activity" hint="Lihat kejadian real-time" />
              <QuickAction href="/ranking" label="Bandingkan Ranking" hint="Sales / Margin / SLA" />
              <QuickAction href="/dashboard" label="Executive KPI" hint="Portfolio-level metrics" />
              <QuickAction href="/site/loc-km22" label="Site Terpilih" hint="Contoh: BUMA KM22" />
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}

function LeaderStat({
  label,
  value,
  hint,
  tone,
  actionHref,
}: {
  label: string;
  value: string;
  hint: string;
  tone: "success" | "primary" | "warning" | "danger" | "muted";
  actionHref?: string;
}) {
  const toneClass =
    tone === "success"
      ? "text-emerald-700 bg-emerald-50"
      : tone === "primary"
        ? "text-primary bg-primary/10"
        : tone === "warning"
          ? "text-amber-700 bg-amber-50"
          : tone === "danger"
            ? "text-rose-700 bg-rose-50"
            : "text-muted-foreground bg-muted";
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        <div className="mt-1.5 flex items-baseline gap-2">
          <span className="truncate text-2xl font-semibold tabular-nums">{value}</span>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className={cn("rounded px-1.5 py-0.5 text-[11px] font-medium", toneClass)}>
            {hint}
          </span>
          {actionHref && (
            <Link
              href={actionHref}
              className="inline-flex items-center gap-0.5 text-[11px] font-medium text-primary hover:underline"
            >
              Buka
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function RankingBlock({
  title,
  tone,
  sites,
  totalContribution,
}: {
  title: string;
  tone: "success" | "warning";
  sites: SiteKpi[];
  totalContribution: number;
}) {
  return (
    <div className="rounded-md border">
      <div
        className={cn(
          "flex items-center justify-between border-b px-3 py-2 text-xs font-semibold uppercase tracking-wide",
          tone === "success" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800",
        )}
      >
        <span>{title}</span>
        <span>{sites.length} site</span>
      </div>
      <ul className="divide-y">
        {sites.map((s, i) => {
          const pct = totalContribution === 0 ? 0 : (s.netMargin / totalContribution) * 100;
          return (
            <li key={s.locationId} className="flex items-center gap-3 px-3 py-2 text-sm">
              <div
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded text-xs font-semibold",
                  tone === "success" ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-900",
                )}
              >
                {i + 1}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{s.locationName}</div>
                <div className="truncate text-[11px] text-muted-foreground">{s.projectCode}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold tabular-nums">{formatCurrency(s.netMargin)}</div>
                <div className="text-[11px] text-muted-foreground tabular-nums">{pct.toFixed(1)}%</div>
              </div>
              <Link
                href={`/site/${s.locationId}`}
                className="text-xs font-medium text-primary hover:underline"
              >
                Detail →
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function PendingApprovalList({ sites }: { sites: SiteKpi[] }) {
  const rows = sites.filter((s) => s.pendingApprovals > 0);
  if (rows.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        Tidak ada approval pending pada scope aktif.
      </div>
    );
  }
  return (
    <ul className="divide-y">
      {rows.map((s) => (
        <li key={s.locationId} className="flex items-center gap-3 px-4 py-3 text-sm">
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">
              {s.projectCode} · {s.locationName}
            </div>
            <div className="text-[11px] text-muted-foreground">Periode invoice {s.invoicePeriod}</div>
          </div>
          <Badge variant={s.overdueInvoices > 0 ? "danger" : "warning"} className="tabular-nums">
            {s.pendingApprovals} pending
          </Badge>
          {s.overdueInvoices > 0 && (
            <Badge variant="danger" className="tabular-nums">
              {s.overdueInvoices} overdue
            </Badge>
          )}
          <Link
            href={`/site/${s.locationId}`}
            className="text-xs font-medium text-primary hover:underline"
          >
            Review →
          </Link>
        </li>
      ))}
    </ul>
  );
}

function QuickAction({ href, label, hint }: { href: string; label: string; hint: string }) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-md border p-3 hover:bg-accent"
    >
      <div className="flex h-8 w-8 items-center justify-center rounded bg-primary/10 text-primary">
        <FileText className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{label}</div>
        <div className="truncate text-[11px] text-muted-foreground">{hint}</div>
      </div>
      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
