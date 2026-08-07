"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Clock, Gauge, Info, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { KpiCard } from "@/components/common/kpi-card";
import { ActivityFilterBar } from "@/components/activity/activity-filter-bar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePersona } from "@/components/providers/persona-provider";
import { useGlobalFilters } from "@/components/providers/global-filter-provider";
import { LOCATION_OPTIONS, PROJECT_OPTIONS } from "@/lib/mock/filters";
import { canAccessLocation } from "@/lib/personas";
import { SITE_KPI } from "@/lib/mock/site-kpi";
import { SITE_DETAILS } from "@/lib/mock/site-detail";
import { buildApprovalRemindersFor } from "@/lib/mock/approvals";
import { APPROVAL_STAGES } from "@/lib/mock/approval-progress";
import { invoiceHref } from "@/lib/mock/invoice-lookup";
import { cn, formatCurrency } from "@/lib/utils";

export function SlaApprovalClient() {
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

  const filteredSites = useMemo(
    () =>
      scopedSites.filter((s) => {
        if (filters.projects.length > 0 && !filters.projects.includes(s.projectCode)) return false;
        if (filters.locations.length > 0 && !selectedLocationIds.has(s.locationId)) return false;
        return true;
      }),
    [scopedSites, filters.projects, filters.locations, selectedLocationIds],
  );

  const approvals = useMemo(
    () => buildApprovalRemindersFor(filteredSites, SITE_DETAILS),
    [filteredSites],
  );

  // Per-site compliance summary (over all sites in scope).
  const bySite = useMemo(() => {
    const map = new Map<string, { id: string; label: string; count: number; within: number }>();
    for (const a of approvals) {
      const e = map.get(a.locationId) ?? { id: a.locationId, label: `${a.projectCode} · ${a.locationName}`, count: 0, within: 0 };
      e.count += 1;
      if (a.timeInStageDays <= a.slaTargetDays) e.within += 1;
      map.set(a.locationId, e);
    }
    return Array.from(map.values())
      .map((e) => ({ ...e, compliance: e.count ? (e.within / e.count) * 100 : 100 }))
      .sort((a, b) => a.compliance - b.compliance);
  }, [approvals]);

  const [siteFilter, setSiteFilter] = useState<string | "all">("all");
  useEffect(() => {
    if (siteFilter !== "all" && !bySite.some((s) => s.id === siteFilter)) setSiteFilter("all");
  }, [bySite, siteFilter]);

  const scopedApprovals = useMemo(
    () => (siteFilter === "all" ? approvals : approvals.filter((a) => a.locationId === siteFilter)),
    [approvals, siteFilter],
  );

  const overall = useMemo(() => {
    const within = scopedApprovals.filter((a) => a.timeInStageDays <= a.slaTargetDays).length;
    const avg = scopedApprovals.length ? scopedApprovals.reduce((s, a) => s + a.timeInStageDays, 0) / scopedApprovals.length : 0;
    return {
      compliance: scopedApprovals.length ? (within / scopedApprovals.length) * 100 : 100,
      breaches: scopedApprovals.length - within,
      avg,
      atRisk: scopedApprovals.filter((a) => a.status === "at_risk").length,
    };
  }, [scopedApprovals]);

  const byStage = useMemo(
    () =>
      APPROVAL_STAGES.map((stage) => {
        const items = scopedApprovals.filter((a) => a.stage === stage);
        const within = items.filter((a) => a.timeInStageDays <= a.slaTargetDays).length;
        const avg = items.length ? items.reduce((s, a) => s + a.timeInStageDays, 0) / items.length : 0;
        const sla = items.length ? items[0].slaTargetDays : 0;
        return { stage, count: items.length, avg, sla, compliance: items.length ? (within / items.length) * 100 : 100 };
      }).filter((s) => s.count > 0),
    [scopedApprovals],
  );

  const worstBreaches = useMemo(
    () =>
      scopedApprovals
        .filter((a) => a.timeInStageDays > a.slaTargetDays)
        .sort((a, b) => b.timeInStageDays - b.slaTargetDays - (a.timeInStageDays - a.slaTargetDays))
        .slice(0, 8),
    [scopedApprovals],
  );

  return (
    <div>
      <PageHeader
        title="SLA Approval Monitoring"
        description="Pantau kepatuhan SLA proses approval invoice — per tahap dan pelanggaran terbesar."
        breadcrumbs={[{ label: "Operasional" }, { label: "SLA Approval" }]}
      />

      <div className="space-y-6 p-4 md:p-6">
        <PersonaBanner persona={persona} scopeSummary={`${scopedSites.length} site accessible`} />

        <div className="flex items-start gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>SLA compliance = invoice yang diproses dalam batas waktu tahapnya. Target SLA per tahap dari Master Workflow.</span>
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
          <KpiCard label="SLA Compliance" value={`${overall.compliance.toFixed(0)}%`} format="text" icon={ShieldCheck} tone={overall.compliance >= 80 ? "success" : "warning"} />
          <KpiCard label="Pelanggaran SLA" value={overall.breaches} format="number" icon={AlertTriangle} tone="danger" />
          <KpiCard label="Rata-rata Waktu" value={`${overall.avg.toFixed(1)} hari`} format="text" icon={Clock} tone="info" />
          <KpiCard label="Berisiko" value={overall.atRisk} format="number" icon={Gauge} tone="warning" />
        </section>

        {bySite.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle>Compliance per Site</CardTitle>
                <CardDescription>Klik site untuk memfilter analisis SLA di bawah.</CardDescription>
              </div>
              {siteFilter !== "all" && (
                <button type="button" onClick={() => setSiteFilter("all")} className="text-[11px] font-medium text-primary hover:underline">
                  Reset filter
                </button>
              )}
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {bySite.map((s) => {
                  const active = siteFilter === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSiteFilter(active ? "all" : s.id)}
                      className={cn(
                        "rounded-md border p-3 text-left transition-shadow hover:shadow-sm",
                        active && "border-primary ring-1 ring-primary",
                      )}
                      aria-pressed={active}
                    >
                      <div className="flex items-center justify-between">
                        <span className="truncate text-xs font-medium">{s.label}</span>
                        <Badge variant={s.compliance >= 80 ? "success" : s.compliance >= 60 ? "warning" : "danger"}>
                          {s.compliance.toFixed(0)}%
                        </Badge>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn("h-full rounded-full", s.compliance >= 80 ? "bg-emerald-500" : s.compliance >= 60 ? "bg-amber-500" : "bg-rose-500")}
                          style={{ width: `${s.compliance}%` }}
                        />
                      </div>
                      <div className="mt-1 text-[11px] text-muted-foreground">{s.within}/{s.count} dalam SLA</div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>SLA per Tahap{siteFilter !== "all" ? " (site terpilih)" : ""}</CardTitle>
            <CardDescription>Waktu rata-rata vs target SLA & tingkat kepatuhan tiap tahap.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2 text-left font-medium">Tahap</th>
                    <th className="px-3 py-2 text-right font-medium">Invoice</th>
                    <th className="px-3 py-2 text-right font-medium">Rata-rata</th>
                    <th className="px-3 py-2 text-right font-medium">Target SLA</th>
                    <th className="px-3 py-2 text-left font-medium">Compliance</th>
                    <th className="px-3 py-2 text-left font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {byStage.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                        Tidak ada invoice dalam alur approval untuk scope ini.
                      </td>
                    </tr>
                  )}
                  {byStage.map((s) => {
                    const status =
                      s.compliance >= 80
                        ? { label: "Sehat", variant: "success" as const, dot: "bg-emerald-500" }
                        : s.compliance >= 60
                          ? { label: "Perhatian", variant: "warning" as const, dot: "bg-amber-500" }
                          : { label: "Kritis", variant: "danger" as const, dot: "bg-rose-500" };
                    return (
                    <tr key={s.stage} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-3 py-2 font-medium">
                        <span className="inline-flex items-center gap-2">
                          <span className={cn("h-2 w-2 rounded-full", status.dot)} />
                          {s.stage}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{s.count}</td>
                      <td className={cn("px-3 py-2 text-right tabular-nums", s.avg > s.sla && "text-rose-600 font-medium")}>
                        {s.avg.toFixed(1)} hari
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{s.sla} hari</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                            <div
                              className={cn("h-full rounded-full", s.compliance >= 80 ? "bg-emerald-500" : s.compliance >= 60 ? "bg-amber-500" : "bg-rose-500")}
                              style={{ width: `${s.compliance}%` }}
                            />
                          </div>
                          <span className="text-[11px] tabular-nums text-muted-foreground">{s.compliance.toFixed(0)}%</span>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-rose-500" />
              Pelanggaran SLA Terbesar
            </CardTitle>
            <CardDescription>Invoice yang paling lama melewati target SLA tahapnya.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {worstBreaches.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">Tidak ada pelanggaran SLA. </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                      <th className="px-3 py-2 text-left font-medium">Invoice</th>
                      <th className="px-3 py-2 text-left font-medium">Site</th>
                      <th className="px-3 py-2 text-left font-medium">Tahap</th>
                      <th className="px-3 py-2 text-right font-medium">Kelebihan</th>
                      <th className="px-3 py-2 text-left font-medium">Assignee</th>
                      <th className="px-3 py-2 text-right font-medium">Nilai</th>
                    </tr>
                  </thead>
                  <tbody>
                    {worstBreaches.map((a) => (
                      <tr key={a.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-3 py-2">
                          <Link href={invoiceHref(a.invoiceNumber)} className="font-medium tabular-nums text-primary hover:underline">
                            {a.invoiceNumber}
                          </Link>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{a.projectCode} · {a.locationName}</td>
                        <td className="px-3 py-2 text-muted-foreground">{a.stage}</td>
                        <td className="px-3 py-2 text-right">
                          <Badge variant="danger">+{a.timeInStageDays - a.slaTargetDays} hari</Badge>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{a.assignee}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-medium">{formatCurrency(a.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
