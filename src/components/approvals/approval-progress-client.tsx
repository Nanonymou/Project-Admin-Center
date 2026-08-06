"use client";

import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, Clock3, Download, Info, Lock, Pencil, ShieldAlert } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { usePersona } from "@/components/providers/persona-provider";
import { useGlobalFilters } from "@/components/providers/global-filter-provider";
import { daysBetween, SITE_KPI } from "@/lib/mock/site-kpi";
import { SITE_DETAILS, type SiteDetail } from "@/lib/mock/site-detail";
import { APPROVAL_STAGES, type ApprovalStageName } from "@/lib/mock/approval-progress";
import {
  buildApprovalRemindersFor,
  type ApprovalReminder,
  type ApprovalReminderPriority,
} from "@/lib/mock/approvals";
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

  // Local edits applied to approval activities this session.
  const [approvalOverrides, setApprovalOverrides] = useState<Record<string, Partial<ApprovalReminder>>>({});

  const allApprovals = useMemo(
    () =>
      buildApprovalRemindersFor(filteredSites, scopedDetailMap).map((a) =>
        approvalOverrides[a.id] ? { ...a, ...approvalOverrides[a.id] } : a,
      ),
    [filteredSites, scopedDetailMap, approvalOverrides],
  );

  // Change history for activity edits this session.
  const [editHistory, setEditHistory] = useState<
    { id: string; invoiceNumber: string; changes: string; by: string; time: string }[]
  >([]);

  // Read-only activity detail modal state.
  const [detailTarget, setDetailTarget] = useState<ApprovalReminder | null>(null);

  // Edit-activity modal state.
  const [editTarget, setEditTarget] = useState<ApprovalReminder | null>(null);
  const [editAssignee, setEditAssignee] = useState("");
  const [editPriority, setEditPriority] = useState<ApprovalReminderPriority>("medium");
  const [editStage, setEditStage] = useState<ApprovalStageName>("Verifikasi Site");

  function openEdit(a: ApprovalReminder) {
    setEditTarget(a);
    setEditAssignee(a.assignee);
    setEditPriority(a.priority);
    setEditStage(a.stage as ApprovalStageName);
  }

  function saveEdit() {
    if (!editTarget) return;
    const changes: string[] = [];
    const assignee = editAssignee.trim() || editTarget.assignee;
    if (assignee !== editTarget.assignee) changes.push(`Assignee: ${editTarget.assignee} → ${assignee}`);
    if (editPriority !== editTarget.priority) changes.push(`Prioritas: ${editTarget.priority} → ${editPriority}`);
    if (editStage !== editTarget.stage) changes.push(`Stage: ${editTarget.stage} → ${editStage}`);
    setApprovalOverrides((prev) => ({
      ...prev,
      [editTarget.id]: { assignee, priority: editPriority, stage: editStage },
    }));
    if (changes.length > 0) {
      setEditHistory((prev) => [
        {
          id: `${editTarget.id}-${Date.now()}`,
          invoiceNumber: editTarget.invoiceNumber,
          changes: changes.join(" · "),
          by: persona.roleLabel,
          time: new Date().toLocaleTimeString("id-ID"),
        },
        ...prev,
      ]);
    }
    setEditTarget(null);
  }

  const canEditApproval =
    persona.role === "leader_admin" || persona.role === "super_admin" || persona.role === "site_admin";

  const [queueLocation, setQueueLocation] = useState<string | "all">("all");
  const queueLocations = useMemo(() => {
    const map = new Map<string, { id: string; name: string; project: string }>();
    for (const a of allApprovals) map.set(a.locationId, { id: a.locationId, name: a.locationName, project: a.projectCode });
    return Array.from(map.values()).sort((x, y) => x.name.localeCompare(y.name));
  }, [allApprovals]);

  useEffect(() => {
    if (queueLocation !== "all" && !queueLocations.some((l) => l.id === queueLocation)) setQueueLocation("all");
  }, [queueLocations, queueLocation]);

  // Location focus applied to the analytical panels and the queue.
  const scopedApprovals = useMemo(
    () => (queueLocation === "all" ? allApprovals : allApprovals.filter((a) => a.locationId === queueLocation)),
    [allApprovals, queueLocation],
  );

  const approvals = useMemo(
    () => scopedApprovals.filter((a) => stageFilter === "all" || a.stage === stageFilter),
    [scopedApprovals, stageFilter],
  );

  // Colored status split of the currently shown queue.
  const queueStatus = useMemo(() => {
    let onTime = 0;
    let atRisk = 0;
    let overdue = 0;
    for (const a of approvals) {
      if (a.status === "on_time" || a.status === "approved") onTime += 1;
      else if (a.status === "at_risk") atRisk += 1;
      else overdue += 1;
    }
    return { onTime, atRisk, overdue, total: approvals.length };
  }, [approvals]);

  const stages = useMemo(() => buildStageProgress(allApprovals), [allApprovals]);

  // Per-stage timeline: count + average time-in-stage for each approval stage.
  const stageTimeline = useMemo(
    () =>
      APPROVAL_STAGES.map((stage) => {
        const items = scopedApprovals.filter((a) => a.stage === stage);
        const avg = items.length ? items.reduce((s, a) => s + a.timeInStageDays, 0) / items.length : 0;
        const sla = items.length ? items[0].slaTargetDays : 0;
        return { stage, count: items.length, avg, sla, breaching: avg > sla && sla > 0 };
      }),
    [scopedApprovals],
  );

  // Invoice due cards: remaining days before the stage SLA is breached.
  const dueCards = useMemo(
    () =>
      scopedApprovals
        .map((a) => ({ ...a, remaining: a.slaTargetDays - a.timeInStageDays }))
        .sort((a, b) => a.remaining - b.remaining)
        .slice(0, 6),
    [scopedApprovals],
  );

  // Activities that are overdue or not finished on time — sorted most urgent first.
  const attentionItems = useMemo(() => {
    const rank: Record<string, number> = { escalation: 0, overdue: 1, at_risk: 2 };
    return scopedApprovals
      .filter((a) => a.status === "overdue" || a.status === "escalation" || a.status === "at_risk")
      .sort((a, b) => {
        const ra = rank[a.status] ?? 9;
        const rb = rank[b.status] ?? 9;
        if (ra !== rb) return ra - rb;
        return b.timeInStageDays - b.slaTargetDays - (a.timeInStageDays - a.slaTargetDays);
      });
  }, [scopedApprovals]);

  // Age distribution — how long invoices have sat in their current stage.
  const ageBuckets = useMemo(() => {
    const defs = [
      { label: "0–2 hari", min: 0, max: 2 },
      { label: "3–5 hari", min: 3, max: 5 },
      { label: "6–10 hari", min: 6, max: 10 },
      { label: ">10 hari", min: 11, max: Infinity },
    ];
    return defs.map((d) => ({
      label: d.label,
      count: scopedApprovals.filter((a) => a.timeInStageDays >= d.min && a.timeInStageDays <= d.max).length,
    }));
  }, [scopedApprovals]);

  // Workload per assignee across the pending queue.
  const assigneeWorkload = useMemo(() => {
    const map = new Map<string, { count: number; amount: number; overdue: number }>();
    for (const a of scopedApprovals) {
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
  }, [scopedApprovals]);

  // SLA summary across the pending approval queue.
  const slaSummary = useMemo(() => {
    if (scopedApprovals.length === 0) return null;
    const withinSla = scopedApprovals.filter((a) => a.timeInStageDays <= a.slaTargetDays).length;
    const avgTime = scopedApprovals.reduce((s, a) => s + a.timeInStageDays, 0) / scopedApprovals.length;
    return {
      compliancePct: (withinSla / scopedApprovals.length) * 100,
      avgTime,
      breaching: scopedApprovals.length - withinSla,
    };
  }, [scopedApprovals]);

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

        {queueLocations.length > 1 && (
          <div className="flex flex-wrap items-center gap-2 rounded-md border bg-card p-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Fokus Lokasi
            </span>
            <button
              type="button"
              onClick={() => setQueueLocation("all")}
              className={cn(
                "rounded-md border px-2.5 py-1 text-xs font-medium",
                queueLocation === "all"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input bg-background hover:bg-accent",
              )}
            >
              Semua lokasi
            </button>
            {queueLocations.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => setQueueLocation(l.id)}
                className={cn(
                  "rounded-md border px-2.5 py-1 text-xs font-medium",
                  queueLocation === l.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-background hover:bg-accent",
                )}
              >
                {l.project} · {l.name}
              </button>
            ))}
            {queueLocation !== "all" && (
              <span className="ml-auto text-[11px] text-muted-foreground">
                Panel analitik & antrian difokuskan ke lokasi terpilih.
              </span>
            )}
          </div>
        )}

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

        {scopedApprovals.length > 0 && (
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

        {scopedApprovals.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Distribusi Umur Approval</CardTitle>
              <CardDescription>Lama invoice berada di tahap saat ini — semakin tua semakin berisiko.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {ageBuckets.map((b, i) => {
                  const max = Math.max(1, ...ageBuckets.map((x) => x.count));
                  const tone = ["text-emerald-700", "text-sky-700", "text-amber-700", "text-rose-700"][i];
                  const bar = ["bg-emerald-500", "bg-sky-500", "bg-amber-500", "bg-rose-500"][i];
                  return (
                    <div key={b.label} className="rounded-md border p-3">
                      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{b.label}</div>
                      <div className={cn("mt-1 text-2xl font-bold tabular-nums", tone)}>{b.count}</div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className={cn("h-full rounded-full", bar)} style={{ width: `${(b.count / max) * 100}%` }} />
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
                      <th className="px-3 py-2 text-right font-medium">Aksi</th>
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
                        <td className="px-3 py-2 text-right">
                          <div className="inline-flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => setDetailTarget(a)}
                              className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
                            >
                              <Info className="h-3 w-3" />
                              Detail
                            </button>
                            {canEditApproval && (
                              <button
                                type="button"
                                onClick={() => openEdit(a)}
                                className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                              >
                                <Pencil className="h-3 w-3" />
                                Edit
                              </button>
                            )}
                          </div>
                        </td>
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

            {queueStatus.total > 0 && (
              <div className="space-y-1">
                <div className="flex h-2.5 overflow-hidden rounded-full bg-muted">
                  <div className="bg-emerald-500" style={{ width: `${(queueStatus.onTime / queueStatus.total) * 100}%` }} />
                  <div className="bg-amber-500" style={{ width: `${(queueStatus.atRisk / queueStatus.total) * 100}%` }} />
                  <div className="bg-rose-500" style={{ width: `${(queueStatus.overdue / queueStatus.total) * 100}%` }} />
                </div>
                <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-sm bg-emerald-500" /> On Time · {queueStatus.onTime}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-sm bg-amber-500" /> At Risk · {queueStatus.atRisk}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-sm bg-rose-500" /> Overdue · {queueStatus.overdue}
                  </span>
                </div>
              </div>
            )}

            <ApprovalReminderList items={approvals} />
          </CardContent>
        </Card>

        {editHistory.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Riwayat Perubahan Aktivitas</CardTitle>
              <CardDescription>Jejak edit assignee, prioritas & stage pada sesi ini.</CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="space-y-2">
                {editHistory.map((h) => (
                  <li key={h.id} className="flex items-start gap-3 text-sm">
                    <Pencil className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium tabular-nums">{h.invoiceNumber}</div>
                      <div className="text-[11px] text-muted-foreground">{h.changes}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {h.by} · {h.time}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog
        open={detailTarget !== null}
        onClose={() => setDetailTarget(null)}
        title="Detail Aktivitas Approval"
        description={detailTarget ? `${detailTarget.projectCode} · ${detailTarget.locationName}` : undefined}
        footer={
          detailTarget && (
            <div className="flex items-center justify-end gap-2">
              <Link href={invoiceHref(detailTarget.invoiceNumber)}>
                <Button size="sm" variant="outline">Buka Invoice</Button>
              </Link>
              {canEditApproval && (
                <Button
                  size="sm"
                  onClick={() => {
                    const t = detailTarget;
                    setDetailTarget(null);
                    openEdit(t);
                  }}
                >
                  <Pencil className="h-4 w-4" />
                  Edit
                </Button>
              )}
            </div>
          )
        }
      >
        {detailTarget && (
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium tabular-nums text-primary">{detailTarget.invoiceNumber}</span>
              <Badge
                variant={
                  detailTarget.status === "overdue" || detailTarget.status === "escalation"
                    ? "danger"
                    : detailTarget.status === "at_risk"
                      ? "warning"
                      : "success"
                }
              >
                {detailTarget.stage}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-3 rounded-md border bg-muted/20 p-3 text-xs">
              <DetailRow label="Nilai" value={formatCurrency(detailTarget.amount)} />
              <DetailRow label="Prioritas" value={detailTarget.priority.toUpperCase()} />
              <DetailRow label="Assignee" value={detailTarget.assignee} />
              <DetailRow label="Disubmit" value={detailTarget.submittedAt} />
              <DetailRow label="Due" value={detailTarget.dueLabel} />
              <DetailRow label="Waktu di tahap" value={`${detailTarget.timeInStageDays}h / SLA ${detailTarget.slaTargetDays}h`} />
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Progress SLA</span>
                <span>{Math.min(100, Math.round((detailTarget.timeInStageDays / Math.max(1, detailTarget.slaTargetDays)) * 100))}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full rounded-full",
                    detailTarget.timeInStageDays > detailTarget.slaTargetDays ? "bg-rose-500" : "bg-primary",
                  )}
                  style={{ width: `${Math.min(100, (detailTarget.timeInStageDays / Math.max(1, detailTarget.slaTargetDays)) * 100)}%` }}
                />
              </div>
            </div>
          </div>
        )}
      </Dialog>

      <Dialog
        open={editTarget !== null}
        onClose={() => setEditTarget(null)}
        title="Edit Aktivitas Approval"
        description={editTarget ? `${editTarget.invoiceNumber} · ${editTarget.projectCode} · ${editTarget.locationName}` : undefined}
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditTarget(null)}>
              Batal
            </Button>
            <Button size="sm" onClick={saveEdit}>
              Simpan
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Assignee</label>
            <Input value={editAssignee} onChange={(e) => setEditAssignee(e.target.value)} placeholder="Nama PIC" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Prioritas</label>
              <select
                value={editPriority}
                onChange={(e) => setEditPriority(e.target.value as ApprovalReminderPriority)}
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Stage</label>
              <select
                value={editStage}
                onChange={(e) => setEditStage(e.target.value as ApprovalStageName)}
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              >
                {APPROVAL_STAGES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-medium tabular-nums">{value}</div>
    </div>
  );
}
