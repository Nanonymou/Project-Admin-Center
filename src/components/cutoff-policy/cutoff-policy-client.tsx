"use client";

import { useMemo } from "react";
import { CalendarClock, Building2, Percent, Timer } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { KpiCard } from "@/components/common/kpi-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePersona } from "@/components/providers/persona-provider";
import { SITE_KPI } from "@/lib/mock/site-kpi";
import { canAccessLocation } from "@/lib/personas";
import {
  buildCutOffRows,
  getInvoicePeriodType,
  getCutOffDate,
  daysUntilCutOff,
  CUTOFF_STATUS_META,
} from "@/lib/mock/cutoff-config";
import { getTaxConfig } from "@/lib/mock/tax-config";
import { cn } from "@/lib/utils";

export function CutOffPolicyClient() {
  const { persona } = usePersona();

  const scopedSites = useMemo(
    () => SITE_KPI.filter((s) => canAccessLocation(persona, s.locationId, s.projectCode)),
    [persona],
  );

  const projectCodes = useMemo(
    () => Array.from(new Set(scopedSites.map((s) => s.projectCode))).sort(),
    [scopedSites],
  );

  const policies = useMemo(
    () =>
      projectCodes.map((code) => {
        const type = getInvoicePeriodType(code);
        return {
          code,
          periodType: type,
          periodLabel: type === "15-14" ? "Tanggal 15 – 14 bulan berikutnya" : "Tanggal 1 – akhir bulan",
          cutOff: getCutOffDate(code).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" }),
          daysLeft: daysUntilCutOff(code),
          tax: getTaxConfig(code).label,
        };
      }),
    [projectCodes],
  );

  const cutOffRows = useMemo(() => buildCutOffRows(scopedSites), [scopedSites]);
  const nearest = cutOffRows.length ? cutOffRows[0].daysLeft : 0;

  return (
    <div>
      <PageHeader
        title="Kebijakan Cut-Off & Input Data"
        description="Aturan periode input, tanggal cut-off, dan pajak per project — dibaca dari konfigurasi (bukan hardcode)."
        breadcrumbs={[{ label: "Master Data" }, { label: "Kebijakan Cut-Off" }]}
      />

      <div className="space-y-6 p-4 md:p-6">
        <PersonaBanner persona={persona} scopeSummary={`${scopedSites.length} site accessible`} />

        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiCard label="Project" value={projectCodes.length} format="number" icon={Building2} tone="primary" />
          <KpiCard label="Site" value={scopedSites.length} format="number" icon={Building2} tone="info" />
          <KpiCard label="Cut-Off Terdekat" value={nearest} format="number" icon={Timer} tone={nearest <= 2 ? "danger" : "warning"} sub="hari lagi" />
          <KpiCard label="Aturan Input" value={"H+1"} format="text" icon={CalendarClock} tone="muted" />
        </section>

        <div className="flex items-start gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">
          <CalendarClock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            <b>Aturan Input H+1</b>: transaksi harian hanya boleh diinput untuk hari ini atau kemarin.
            Setelah cut-off, periode dikunci dan input ditutup.
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {policies.map((p) => (
            <Card key={p.code}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-primary" />
                    {p.code}
                  </span>
                  <Badge variant="muted">{p.periodType}</Badge>
                </CardTitle>
                <CardDescription>{p.periodLabel}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <PolicyRow icon={CalendarClock} label="Cut-off" value={p.cutOff} />
                <PolicyRow
                  icon={Timer}
                  label="Sisa hari"
                  value={p.daysLeft <= 0 ? "Sudah lewat" : `H-${p.daysLeft}`}
                  tone={p.daysLeft <= 0 ? "text-rose-700" : p.daysLeft <= 2 ? "text-amber-700" : undefined}
                />
                <PolicyRow icon={Percent} label="Pajak" value={p.tax} />
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Cut-Off per Site</CardTitle>
            <CardDescription>Tanggal cut-off & status kesiapan closing untuk tiap site.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2 text-left font-medium">Site</th>
                    <th className="px-3 py-2 text-left font-medium">Periode</th>
                    <th className="px-3 py-2 text-left font-medium">Cut-Off</th>
                    <th className="px-3 py-2 text-right font-medium">Sisa Hari</th>
                    <th className="px-3 py-2 text-left font-medium">Status</th>
                    <th className="px-3 py-2 text-right font-medium">Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {cutOffRows.map((r) => {
                    const meta = CUTOFF_STATUS_META[r.status];
                    return (
                      <tr key={r.locationId} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-3 py-2 font-medium">
                          {r.projectCode} · {r.locationName}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{r.periodLabel}</td>
                        <td className="px-3 py-2 text-muted-foreground">{r.cutOffDate}</td>
                        <td
                          className={cn(
                            "px-3 py-2 text-right tabular-nums",
                            r.daysLeft <= 0 ? "text-rose-600 font-semibold" : r.daysLeft <= 2 ? "text-amber-700" : "",
                          )}
                        >
                          {r.daysLeft <= 0 ? "Lewat" : `H-${r.daysLeft}`}
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant={meta.variant}>{meta.label}</Badge>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{r.submittedPct}%</td>
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

function PolicyRow({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </span>
      <span className={cn("font-medium tabular-nums", tone)}>{value}</span>
    </div>
  );
}
