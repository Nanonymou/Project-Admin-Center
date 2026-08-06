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
import { invoiceHref } from "@/lib/mock/invoice-lookup";
import { canAccessLocation } from "@/lib/personas";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { cn, formatCurrency } from "@/lib/utils";

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

  // Per-stage timeline: count + average time-in-stage for each approval stage.
  const stageTimeline = useMemo(
    () =>
      APPROVAL_STAGES.map((stage) => {
        const items = allApprovals.filter((a) => a.stage === stage);
        const avg = items.length ? items.reduce((s, a) => s + a.timeInStageDays, 0) / items.length : 0;
        const sla = items.length ? items[0].slaTargetDays : 0;
        return { stage, count: items.length, avg, sla, breaching: avg > sla && sla > 0 };
      }),
    [allApprovals],
  );

  // Invoice due cards: remaining days before the stage SLA is breached.
  const dueCards = useMemo(
    () =>
      allApprovals
        .map((a) => ({ ...a, remaining: a.slaTargetDays - a.timeInStageDays }))
        .sort((a, b) => a.remaining - b.remaining)
        .slice(0, 6),
    [allApprovals],
  );

  // Activities that are overdue or not finished on time — sorted most urgent first.
  const attentionItems = useMemo(() => {
    const rank: Record<string, number> = { escalation: 0, overdue: 1, at_risk: 2 };
    return allApprovals
      .filter((a) => a.status === "overdue" || a.status === "escalation" || a.status === "at_risk")
      .sort((a, b) => {
        const ra = rank[a.status] ?? 9;
        const rb = rank[b.status] ?? 9;
        if (ra !== rb) return ra - rb;
        return b.timeInStageDays - b.slaTargetDays - (a.timeInStageDays - a.slaTargetDays);
      });
  }, [allApprovals]);

  // Workload per assignee across the pending queue.
  const assigneeWorkload = useMemo(() => {
    const map = new Map<string, { count: number; amount: number; overdue: number }>();
    for (const a of allApprovals) {
      const e = map.get(a.assignee) ?? { count: 0, amount: 0, overdue: 0 };
      e.count += 1;
      e.amount += a.amount;
      if (a.status === "overdue" || a.status === "escalation") e.overdue += 1;
      map.set(a.assignee, e);
    }
    return Array.from(map.entries())
      .map(([assignee, v]) => ({ assignee, ...v }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [allApprovals]);

  // SLA summary across the pending approval queue.
  const slaSummary = useMemo(() => {
    if (allApprovals.length === 0) return null;
    const withinSla = allApprovals.filter((a) => a.timeInStageDays <= a.slaTargetDays).length;
    const avgTime = allApprovals.reduce((s, a) => s + a.timeInStageDays, 0) / allApprovals.length;
    return {
      compliancePct: (withinSla / allApprovals.length) * 100,
      avgTime,
      breaching: allApprovals.length - withinSla,
    };
  }, [allApprovals]);

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

        {allApprovals.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Timeline Tahapan Approval</CardTitle>
              <CardDescription>
                Rata-rata waktu di tiap tahap vs target SLA — tahap merah melewati SLA.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-0">
                {stageTimeline.map((s, i) => (
                  <li key={s.stage} className="flex-1">
                    <div className="flex items-center gap-2 sm:flex-col sm:items-start sm:gap-1">
                      <div className="flex items-center">
                        <span
                          className={cn(
                            "flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold text-white",
                            s.breaching ? "bg-rose-500" : s.count > 0 ? "bg-primary" : "bg-muted-foreground/40",
                          )}
                        >
                          {i + 1}
                        </span>
                        {i < stageTimeline.length - 1 && (
                          <span className="mx-1 hidden h-px w-8 bg-border sm:block" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-xs font-medium">{s.stage}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {s.count} invoice · {s.avg.toFixed(1)} hari
                          {s.sla > 0 && <span className="text-muted-foreground/70"> / SLA {s.sla}h</span>}
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        )}

        {slaSummary && (
          <Card>
            <CardHeader>
              <CardTitle>Ringkasan SLA</CardTitle>
              <CardDescription>
                Kepatuhan SLA antrian approval — waktu di tahap dibanding target SLA.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-md border p-3">
                  <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    SLA Compliance
                  </div>
                  <div
                    className={cn(
                      "mt-1 text-2xl font-bold tabular-nums",
                      slaSummary.compliancePct >= 80
                        ? "text-emerald-700"
                        : slaSummary.compliancePct >= 60
                          ? "text-amber-600"
                          : "text-rose-700",
                    )}
                  >
                    {slaSummary.compliancePct.toFixed(0)}%
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${slaSummary.compliancePct}%` }}
                    />
                  </div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Rata-rata Waktu di Tahap
                  </div>
                  <div className="mt-1 text-2xl font-bold tabular-nums">
                    {slaSummary.avgTime.toFixed(1)} <span className="text-sm font-normal text-muted-foreground">hari</span>
                  </div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Melewati SLA
                  </div>
                  <div className="mt-1 text-2xl font-bold tabular-nums text-rose-700">
                    {slaSummary.breaching}
                  </div>
                  <div className="text-[11px] text-muted-foreground">invoice perlu eskalasi</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {assigneeWorkload.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Beban Approval per Assignee</CardTitle>
              <CardDescription>Distribusi invoice menunggu tindakan per PIC — bar merah = overdue.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {assigneeWorkload.map((w) => {
                  const max = assigneeWorkload[0].count || 1;
                  const pct = (w.count / max) * 100;
                  const overduePct = w.count > 0 ? (w.overdue / w.count) * 100 : 0;
                  return (
                    <div key={w.assignee} className="flex items-center gap-3">
                      <div className="w-36 shrink-0 truncate text-xs font-medium">{w.assignee}</div>
                      <div className="relative h-3 flex-1 overflow-hidden rounded-full bg-muted" style={{ maxWidth: `${pct}%` }}>
                        <div className="absolute inset-0 bg-primary" />
                        <div className="absolute inset-y-0 left-0 bg-rose-500" style={{ width: `${overduePct}%` }} />
                      </div>
                      <div className="w-10 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">{w.count}</div>
                      <div className="w-16 shrink-0 text-right text-[11px] tabular-nums text-rose-600">
                        {w.overdue > 0 ? `${w.overdue} od` : "—"}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {dueCards.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Invoice Due & Sisa Hari</CardTitle>
              <CardDescription>Invoice paling mendekati batas SLA tahapnya.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {dueCards.map((a) => {
                  const tone =
                    a.remaining <= 0
                      ? "border-rose-300 bg-rose-50"
                      : a.remaining <= 2
                        ? "border-amber-300 bg-amber-50"
                        : "border-emerald-200 bg-emerald-50/50";
                  const remainingLabel =
                    a.remaining < 0
                      ? `Terlambat ${Math.abs(a.remaining)} hari`
                      : a.remaining === 0
                        ? "Jatuh tempo hari ini"
                        : `Sisa ${a.remaining} hari`;
                  return (
                    <Link
                      key={a.id}
                      href={invoiceHref(a.invoiceNumber)}
                      className={cn("block rounded-lg border p-3 transition-colors hover:shadow-sm", tone)}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold tabular-nums text-primary">{a.invoiceNumber}</span>
                        <Clock3
                          className={cn(
                            "h-4 w-4",
                            a.remaining <= 0 ? "text-rose-600" : a.remaining <= 2 ? "text-amber-600" : "text-emerald-600",
                          )}
                        />
                      </div>
                      <div className="mt-0.5 text-[11px] text-muted-foreground">
                        {a.projectCode} · {a.locationName} · {a.stage}
                      </div>
                      <div
                        className={cn(
                          "mt-2 text-lg font-bold",
                          a.remaining <= 0 ? "text-rose-700" : a.remaining <= 2 ? "text-amber-700" : "text-emerald-700",
                        )}
                      >
                        {remainingLabel}
                      </div>
                      <div className="text-[11px] text-muted-foreground">{formatCurrency(a.amount)} · {a.assignee}</div>
                    </Link>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

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
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-rose-500" />
              Aktivitas Belum Selesai & Terlambat
            </CardTitle>
            <CardDescription>
              Invoice yang melewati atau berisiko melewati SLA — perlu tindakan segera.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {attentionItems.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                <BadgeCheck className="h-4 w-4 text-emerald-500" />
                Tidak ada aktivitas terlambat pada scope ini.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                      <th className="px-3 py-2 text-left font-medium">Invoice</th>
                      <th className="px-3 py-2 text-left font-medium">Site</th>
                      <th className="px-3 py-2 text-left font-medium">Stage</th>
                      <th className="px-3 py-2 text-left font-medium">Status</th>
                      <th className="px-3 py-2 text-right font-medium">Waktu / SLA</th>
                      <th className="px-3 py-2 text-left font-medium">Assignee</th>
                      <th className="px-3 py-2 text-right font-medium">Nilai</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attentionItems.slice(0, 12).map((a) => (
                      <tr key={a.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-3 py-2">
                          <Link href={invoiceHref(a.invoiceNumber)} className="font-medium text-primary hover:underline">
                            {a.invoiceNumber}
                          </Link>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {a.projectCode} · {a.locationName}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{a.stage}</td>
                        <td className="px-3 py-2">
                          <Badge variant={a.status === "at_risk" ? "warning" : "danger"}>
                            {a.status === "escalation" ? "Eskalasi" : a.status === "overdue" ? "Terlambat" : "At Risk"}
                          </Badge>
                        </td>
                        <td
                          className={cn(
                            "px-3 py-2 text-right tabular-nums",
                            a.timeInStageDays > a.slaTargetDays && "font-semibold text-rose-600",
                          )}
                        >
                          {a.timeInStageDays}h / {a.slaTargetDays}h
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{a.assignee}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-medium">{formatCurrency(a.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {attentionItems.length > 12 && (
                  <div className="border-t px-3 py-2 text-[11px] text-muted-foreground">
                    Menampilkan 12 dari {attentionItems.length} aktivitas terlambat.
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

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
