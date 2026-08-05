"use client";

import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, Clock3, Download, Info, Lock, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { ActivityFilterBar } from "@/components/activity/activity-filter-bar";
import { ActivePeriodBadge } from "@/components/common/active-period-badge";
import { AutoRefreshControl } from "@/components/common/auto-refresh-control";
import { useAutoRefresh } from "@/lib/hooks/use-auto-refresh";
import { KpiCard } from "@/components/common/kpi-card";
import { StageProgressBar } from "@/components/approvals/stage-progress-bar";
import { SiteProgressCards, type SiteProgressData } from "@/components/approvals/site-progress-cards";
import { ApprovalReminderList } from "@/components/reminders/approval-reminder-list";
import { buildApprovalReminders } from "@/lib/mock/approvals";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { usePersona } from "@/components/providers/persona-provider";
import { useGlobalFilters } from "@/components/providers/global-filter-provider";
import { daysBetween, SITE_KPI } from "@/lib/mock/site-kpi";
import { SITE_DETAILS, type SiteDetail } from "@/lib/mock/site-detail";
import { APPROVAL_STAGES, type ApprovalStageName } from "@/lib/mock/approval-progress";
import { buildApprovalRemindersFor } from "@/lib/mock/approvals";
import { buildStageProgress, summarizeApprovalProgress } from "@/lib/mock/approval-progress";
import { LOCATION_OPTIONS, PROJECT_OPTIONS } from "@/lib/mock/filters";
import { canAccessLocation } from "@/lib/personas";
import { cn } from "@/lib/utils";

export function ApprovalProgressClient() {
  const { persona } = usePersona();
  const { filters, setFilters, reset } = useGlobalFilters();
  const [stageFilter, setStageFilter] = useState<ApprovalStageName | "all">("all");
  const refresh = useAutoRefresh(15000, false);

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

  // Period-scoped detail map: scale each site's invoice list by the selected
  // period so the funnel/queue respond to the time filter, not just the site.
  const periodFactor = useMemo(() => {
    const days = daysBetween(filters.from, filters.to);
    return Math.max(0.05, Math.min(1, days / 30));
  }, [filters.from, filters.to]);

  const scopedDetailMap = useMemo(() => {
    const map: Record<string, SiteDetail> = {};
    for (const site of filteredSites) {
      const detail = SITE_DETAILS[site.locationId];
      if (!detail) continue;
      const count = Math.max(1, Math.round(detail.invoices.length * periodFactor));
      map[site.locationId] = { ...detail, invoices: detail.invoices.slice(0, count) };
    }
    return map;
  }, [filteredSites, periodFactor]);

  const allApprovals = useMemo(
    () => buildApprovalRemindersFor(filteredSites, scopedDetailMap),
    [filteredSites, scopedDetailMap],
  );

  const approvals = useMemo(
    () => (stageFilter === "all" ? allApprovals : allApprovals.filter((a) => a.stage === stageFilter)),
    [allApprovals, stageFilter],
  );

  const stages = useMemo(() => buildStageProgress(allApprovals), [allApprovals]);

  const settledCount = useMemo(
    () =>
      filteredSites.reduce((total, site) => {
        const detail = scopedDetailMap[site.locationId];
        if (!detail) return total;
        return total + detail.invoices.filter((i) => i.stage === "Payment" && i.status !== "overdue").length;
      }, 0),
    [filteredSites, scopedDetailMap],
  );

  const baseSummary = useMemo(
    () => summarizeApprovalProgress(allApprovals, settledCount),
    [allApprovals, settledCount],
  );

  // Simulated realtime: each refresh nudges a couple of invoices from
  // at-risk toward on-time / overdue so the numbers visibly "move".
  const summary = useMemo(() => {
    if (refresh.nonce === 0) return baseSummary;
    const swing = ((refresh.nonce * 7) % 5) - 2; // -2..2
    const atRisk = Math.max(0, baseSummary.atRisk - Math.abs(swing));
    const shifted = baseSummary.atRisk - atRisk;
    return {
      ...baseSummary,
      atRisk,
      onTime: baseSummary.onTime + (swing >= 0 ? shifted : 0),
      overdue: baseSummary.overdue + (swing < 0 ? shifted : 0),
    };
  }, [baseSummary, refresh.nonce]);

  const siteProgress = useMemo<SiteProgressData[]>(
    () =>
      filteredSites.map((site) => {
        const detail = scopedDetailMap[site.locationId];
        const reminders = detail ? buildApprovalReminders(site, detail) : [];
        const settled = detail
          ? detail.invoices.filter((i) => i.stage === "Payment" && i.status !== "overdue").length
          : 0;
        return {
          locationId: site.locationId,
          locationName: site.locationName,
          projectCode: site.projectCode,
          reminders,
          settledCount: settled,
        };
      }),
    [filteredSites, scopedDetailMap],
  );

  const canExport = persona.capabilities.canExport;

  return (
    <div>
      <PageHeader
        title="Approval Progress Seluruh Site"
        description="Monitoring alur approval invoice lintas site — funnel per tahap, SLA, dan antrian tindakan."
        breadcrumbs={[{ label: "Operasional" }, { label: "Approval Progress" }]}
        actions={
          <>
            <ActivePeriodBadge />
            <AutoRefreshControl state={refresh} />
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
            Progress dihitung dari alur Master Workflow (Verifikasi Site → Payment). Filter global
            aktif — pilihan project & location sinkron dengan halaman lain.
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

        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiCard
            label="Total Invoice Approval"
            value={summary.total}
            format="number"
            icon={BadgeCheck}
            tone="primary"
            sub={`${settledCount} settled`}
          />
          <KpiCard
            label="On Time"
            value={summary.onTime}
            format="number"
            icon={BadgeCheck}
            tone="success"
          />
          <KpiCard
            label="At Risk"
            value={summary.atRisk}
            format="number"
            icon={Clock3}
            tone="warning"
          />
          <KpiCard
            label="Overdue / Escalation"
            value={summary.overdue}
            format="number"
            icon={ShieldAlert}
            tone="danger"
          />
        </section>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle>Funnel Approval per Tahap</CardTitle>
              <CardDescription>
                Distribusi invoice di setiap tahap · segmen warna = On Time / At Risk / Overdue.
              </CardDescription>
            </div>
            <div className="text-right">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Completion
              </div>
              <div className="text-lg font-semibold tabular-nums">
                {summary.completionPct.toFixed(0)}%
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {approvals.length > 0 || settledCount > 0 ? (
              <StageProgressBar stages={stages} />
            ) : (
              <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                Tidak ada invoice dalam alur approval untuk scope ini.
              </div>
            )}
          </CardContent>
        </Card>

        <section className="space-y-3">
          <div>
            <h2 className="text-base font-semibold">Ringkasan Progress per Site</h2>
            <p className="text-sm text-muted-foreground">
              Diurutkan berdasarkan yang paling butuh perhatian (overdue &amp; completion terendah).
            </p>
          </div>
          <SiteProgressCards sites={siteProgress} />
        </section>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle>Antrian Approval</CardTitle>
              <CardDescription>
                Seluruh invoice menunggu tindakan
                {stageFilter !== "all" && <> pada tahap <b>{stageFilter}</b></>} — filter
                status/prioritas, aksi inline.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Fokus Tahap
              </span>
              <button
                type="button"
                onClick={() => setStageFilter("all")}
                className={cn(
                  "rounded-md border px-2.5 py-1 text-xs font-medium",
                  stageFilter === "all"
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-background hover:bg-accent",
                )}
              >
                Semua · {allApprovals.length}
              </button>
              {APPROVAL_STAGES.filter((s) => s !== "Payment").map((stage) => {
                const count = allApprovals.filter((a) => a.stage === stage).length;
                return (
                  <button
                    key={stage}
                    type="button"
                    onClick={() => setStageFilter(stage)}
                    className={cn(
                      "rounded-md border px-2.5 py-1 text-xs font-medium",
                      stageFilter === stage
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input bg-background hover:bg-accent",
                    )}
                  >
                    {stage} · {count}
                  </button>
                );
              })}
            </div>
            <ApprovalReminderList items={approvals} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
