"use client";

import { useEffect, useMemo } from "react";
import { CheckCircle2, Clock, Info, ShieldCheck, ShieldX } from "lucide-react";
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
import { buildCutOffRows, DELIVERY_STATUS_META } from "@/lib/mock/cutoff-config";
import { cn } from "@/lib/utils";

type Compliance = "compliant" | "at_risk" | "breach";

const COMPLIANCE_META: Record<Compliance, { label: string; variant: "success" | "warning" | "danger" }> = {
  compliant: { label: "Patuh", variant: "success" },
  at_risk: { label: "Berisiko", variant: "warning" },
  breach: { label: "Melanggar", variant: "danger" },
};

function complianceOf(submittedPct: number, daysLeft: number): Compliance {
  if (daysLeft < 0 && submittedPct < 100) return "breach";
  if (submittedPct >= 90) return "compliant";
  if (daysLeft <= 2) return "at_risk";
  return "at_risk";
}

export function ComplianceMonitoringClient() {
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

  const rows = useMemo(
    () =>
      buildCutOffRows(filteredSites).map((r) => ({ ...r, compliance: complianceOf(r.submittedPct, r.daysLeft) })),
    [filteredSites],
  );

  // Daily submission pattern per location (last 14 days) — deterministic mock.
  const dailyCompliance = useMemo(() => {
    return filteredSites.map((s) => {
      let seed = 0;
      for (const ch of s.locationId) seed += ch.charCodeAt(0);
      const days: { label: string; submitted: boolean }[] = [];
      for (let i = 13; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const submitted = Math.abs(Math.sin(seed + i * 1.7)) > 0.24;
        days.push({ label: d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" }), submitted });
      }
      const submittedCount = days.filter((d) => d.submitted).length;
      return {
        locationId: s.locationId,
        label: `${s.projectCode} · ${s.locationName}`,
        days,
        pct: (submittedCount / days.length) * 100,
      };
    });
  }, [filteredSites]);

  const summary = useMemo(() => {
    const compliant = rows.filter((r) => r.compliance === "compliant").length;
    const atRisk = rows.filter((r) => r.compliance === "at_risk").length;
    const breach = rows.filter((r) => r.compliance === "breach").length;
    return {
      total: rows.length,
      compliant,
      atRisk,
      breach,
      rate: rows.length > 0 ? (compliant / rows.length) * 100 : 0,
    };
  }, [rows]);

  return (
    <div>
      <PageHeader
        title="Compliance & Cut-Off Monitoring"
        description="Pantau kepatuhan submit sebelum cut-off — status closing & pengiriman invoice per site."
        breadcrumbs={[{ label: "Operasional" }, { label: "Compliance Monitoring" }]}
      />

      <div className="space-y-6 p-4 md:p-6">
        <PersonaBanner persona={persona} scopeSummary={`${scopedSites.length} site accessible`} />

        <div className="flex items-start gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Kepatuhan dihitung dari progres submit vs tanggal cut-off. Site dengan submit &lt; 90%
            saat cut-off lewat ditandai <b>Melanggar</b>.
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
          <KpiCard label="Tingkat Kepatuhan" value={`${summary.rate.toFixed(0)}%`} format="text" icon={ShieldCheck} tone={summary.rate >= 80 ? "success" : "warning"} />
          <KpiCard label="Patuh" value={summary.compliant} format="number" icon={CheckCircle2} tone="success" />
          <KpiCard label="Berisiko" value={summary.atRisk} format="number" icon={Clock} tone="warning" />
          <KpiCard label="Melanggar" value={summary.breach} format="number" icon={ShieldX} tone="danger" />
        </section>

        {dailyCompliance.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Ringkasan Kepatuhan Harian (14 Hari)</CardTitle>
              <CardDescription>Hijau = submit tepat waktu · merah = terlewat, per lokasi.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {dailyCompliance.map((row) => (
                  <div key={row.locationId} className="flex items-center gap-3">
                    <div className="w-40 shrink-0 truncate text-xs font-medium">{row.label}</div>
                    <div className="flex flex-1 flex-wrap gap-1">
                      {row.days.map((d, i) => (
                        <span
                          key={i}
                          title={`${d.label} · ${d.submitted ? "Submit" : "Terlewat"}`}
                          className={cn("h-4 w-4 rounded-sm", d.submitted ? "bg-emerald-500" : "bg-rose-400")}
                        />
                      ))}
                    </div>
                    <div className={cn("w-12 shrink-0 text-right text-xs font-semibold tabular-nums", row.pct >= 80 ? "text-emerald-700" : row.pct >= 60 ? "text-amber-700" : "text-rose-700")}>
                      {row.pct.toFixed(0)}%
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Status Kepatuhan per Site</CardTitle>
            <CardDescription>Progres submit, tanggal cut-off, dan status pengiriman invoice.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2 text-left font-medium">Site</th>
                    <th className="px-3 py-2 text-left font-medium">Cut-Off</th>
                    <th className="px-3 py-2 text-right font-medium">Sisa Hari</th>
                    <th className="px-3 py-2 text-left font-medium">Submit</th>
                    <th className="px-3 py-2 text-left font-medium">Pengiriman</th>
                    <th className="px-3 py-2 text-left font-medium">Kepatuhan</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                        Tidak ada site dalam scope & filter ini.
                      </td>
                    </tr>
                  )}
                  {rows.map((r) => {
                    const meta = COMPLIANCE_META[r.compliance];
                    const delivery = DELIVERY_STATUS_META[r.delivery];
                    return (
                      <tr key={r.locationId} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-3 py-2 font-medium">
                          {r.projectCode} · {r.locationName}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{r.cutOffDate}</td>
                        <td className={cn("px-3 py-2 text-right tabular-nums", r.daysLeft <= 0 ? "text-rose-600 font-semibold" : r.daysLeft <= 2 ? "text-amber-700" : "")}>
                          {r.daysLeft <= 0 ? "Lewat" : `H-${r.daysLeft}`}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                              <div
                                className={cn("h-full rounded-full", r.submittedPct >= 90 ? "bg-emerald-500" : r.submittedPct >= 60 ? "bg-amber-500" : "bg-rose-500")}
                                style={{ width: `${Math.min(100, r.submittedPct)}%` }}
                              />
                            </div>
                            <span className="text-[11px] tabular-nums text-muted-foreground">{r.submittedPct}%</span>
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant={delivery.variant}>{delivery.label}</Badge>
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant={meta.variant}>{meta.label}</Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
