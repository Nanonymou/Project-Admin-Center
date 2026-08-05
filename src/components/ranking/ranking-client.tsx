"use client";

import { useMemo, useState } from "react";
import { Download, Lock, RefreshCcw } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { RankingPodium } from "@/components/ranking/ranking-podium";
import { RankingList } from "@/components/ranking/ranking-list";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { usePersona } from "@/components/providers/persona-provider";
import { SITE_KPI, type SiteKpi } from "@/lib/mock/site-kpi";
import { PROJECT_OPTIONS } from "@/lib/mock/filters";
import { canAccessLocation } from "@/lib/personas";
import { cn, formatCurrency } from "@/lib/utils";

type Metric = "sales" | "marginPct" | "slaPct" | "netMargin";

const METRIC_MAP: Record<
  Metric,
  {
    label: string;
    short: string;
    raw: (s: SiteKpi) => number;
    display: (s: SiteKpi) => string;
    prev: ((s: SiteKpi) => number | null) | null;
  }
> = {
  sales: {
    label: "Sales periode berjalan",
    short: "Sales",
    raw: (s) => s.sales,
    display: (s) => formatCurrency(s.sales),
    prev: (s) => (s.prevPeriod ? ((s.sales - s.prevPeriod.sales) / s.prevPeriod.sales) * 100 : null),
  },
  netMargin: {
    label: "Net Margin",
    short: "Net Margin",
    raw: (s) => s.netMargin,
    display: (s) => formatCurrency(s.netMargin),
    prev: null,
  },
  marginPct: {
    label: "Margin %",
    short: "Margin %",
    raw: (s) => s.marginPct,
    display: (s) => `${s.marginPct.toFixed(1)}%`,
    prev: (s) => (s.prevPeriod ? s.marginPct - s.prevPeriod.marginPct : null),
  },
  slaPct: {
    label: "SLA Compliance",
    short: "SLA",
    raw: (s) => s.slaPct,
    display: (s) => `${s.slaPct}%`,
    prev: (s) => (s.prevPeriod ? s.slaPct - s.prevPeriod.slaPct : null),
  },
};

export function RankingClient() {
  const { persona } = usePersona();
  const [metric, setMetric] = useState<Metric>("sales");
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);

  const scopedSites = useMemo(
    () => SITE_KPI.filter((s) => canAccessLocation(persona, s.locationId, s.projectCode)),
    [persona],
  );

  const filteredSites = useMemo(() => {
    return scopedSites.filter((s) =>
      selectedProjects.length === 0 ? true : selectedProjects.includes(s.projectCode),
    );
  }, [scopedSites, selectedProjects]);

  const cfg = METRIC_MAP[metric];

  const rankedSites = useMemo(() => {
    return [...filteredSites].sort((a, b) => cfg.raw(b) - cfg.raw(a));
  }, [filteredSites, cfg]);

  const scopeSummary = `${scopedSites.length} site accessible`;

  const canExport = persona.capabilities.canExport;

  const availableProjects = useMemo(
    () => Array.from(new Set(scopedSites.map((s) => s.projectCode))),
    [scopedSites],
  );

  function toggleProject(code: string) {
    setSelectedProjects((prev) =>
      prev.includes(code) ? prev.filter((p) => p !== code) : [...prev, code],
    );
  }

  return (
    <div>
      <PageHeader
        title="Ranking Site"
        description="Perbandingan performa site berdasarkan Sales, Margin, atau SLA — untuk menyorot top performer & yang butuh perhatian."
        breadcrumbs={[{ label: "Overview" }, { label: "Ranking Site" }]}
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
        <PersonaBanner persona={persona} scopeSummary={scopeSummary} />

        <Card>
          <CardContent className="flex flex-wrap items-center gap-3 p-4">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Metrik
            </span>
            {(Object.keys(METRIC_MAP) as Metric[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setMetric(k)}
                className={cn(
                  "rounded-md border px-2.5 py-1 text-xs font-medium",
                  metric === k
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-background hover:bg-accent",
                )}
              >
                {METRIC_MAP[k].short}
              </button>
            ))}
            <span className="ml-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Project
            </span>
            {availableProjects.length === 0 && (
              <span className="text-xs italic text-muted-foreground">
                Tidak ada project dalam scope.
              </span>
            )}
            {PROJECT_OPTIONS.filter((p) => availableProjects.includes(p.code)).map((p) => (
              <button
                key={p.code}
                type="button"
                onClick={() => toggleProject(p.code)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs font-medium",
                  selectedProjects.includes(p.code)
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-input bg-background hover:bg-accent",
                )}
              >
                {p.code}
              </button>
            ))}
            <div className="ml-auto text-xs text-muted-foreground">
              Menampilkan <b className="text-foreground">{rankedSites.length}</b> site
            </div>
          </CardContent>
        </Card>

        {rankedSites.length > 0 && (
          <section>
            <div className="mb-3">
              <h2 className="text-base font-semibold">Podium — {cfg.label}</h2>
              <p className="text-sm text-muted-foreground">
                Top 3 site berdasarkan {cfg.short}. Delta % relatif periode sebelumnya.
              </p>
            </div>
            <RankingPodium
              sites={rankedSites.slice(0, 3)}
              metricLabel={cfg.short}
              metricValue={cfg.display}
            />
          </section>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Ranking Lengkap</CardTitle>
            <CardDescription>
              Diurutkan berdasarkan <b>{cfg.label}</b>. Klik &ldquo;Detail&rdquo; untuk masuk ke Site Dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <RankingList
              sites={rankedSites}
              metricLabel={cfg.short}
              metricValue={cfg.display}
              metricRaw={cfg.raw}
              deltaValue={cfg.prev ?? undefined}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
