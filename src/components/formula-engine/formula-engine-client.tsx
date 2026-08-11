"use client";

import { useMemo, useState } from "react";
import { FunctionSquare, Building2, Percent, Clock, Fuel, Receipt } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePersona } from "@/components/providers/persona-provider";
import { canAccessProject } from "@/lib/personas";
import { MOCK_WORKSPACES } from "@/lib/mock/workspaces";
import { getTaxConfig } from "@/lib/mock/tax-config";
import { getPenaltyConfig } from "@/lib/mock/penalty-config";
import { getBbmConfig } from "@/lib/mock/bbm-config";

const pct = (f: number) => `${(f * 100).toFixed((f * 100) % 1 === 0 ? 0 : 1)}%`;

/**
 * Formula Engine — the config-driven overview of the financial formula
 * parameters per project (PRD §Formula Builder / Tax Engine): tax (PPN/PB1),
 * late-payment penalty, and the BBM fuel surcharge. Each project composes its
 * Net Invoice / Penalty formulas from these data-driven components — no
 * hardcoded `if (project === …)`. Read-only overview; parameter editing is a
 * later task. Persona-scoped by project access.
 */
export function FormulaEngineClient() {
  const { persona } = usePersona();

  const projects = useMemo(() => {
    const map = new Map<string, string>();
    for (const w of MOCK_WORKSPACES) {
      if (canAccessProject(persona, w.projectCode)) map.set(w.projectCode, w.projectName);
    }
    return [...map].map(([projectCode, projectName]) => ({ projectCode, projectName }));
  }, [persona]);

  const [projIndex, setProjIndex] = useState(0);
  const project = projects[projIndex] ?? projects[0];

  if (!project) {
    return (
      <div>
        <PageHeader title="Formula Engine" description="Konfigurasi formula per proyek." />
        <div className="p-6 text-sm text-muted-foreground">Tidak ada proyek dalam cakupan Anda.</div>
      </div>
    );
  }

  const tax = getTaxConfig(project.projectCode);
  const penalty = getPenaltyConfig(project.projectCode);
  const bbm = getBbmConfig(project.projectCode);

  const netFormula = `Net Invoice = (Gross − Backcharge${bbm.applies ? " + BBM" : ""}) × (1 + ${tax.code} ${pct(tax.rate)})`;
  const penaltyFormula = `Penalty = ceil(hari overdue − ${penalty.graceDays} / 30) × ${pct(penalty.monthlyRate)} × Net`;

  return (
    <div>
      <PageHeader
        title="Formula Engine"
        description="Konfigurasi rumus finansial per proyek (config-driven)."
        breadcrumbs={[{ label: "Master Data" }, { label: "Formula Engine" }]}
      />

      <div className="space-y-6 p-4 md:p-6">
        <PersonaBanner persona={persona} scopeSummary={`${projects.length} proyek`} />

        <div className="flex flex-wrap items-center gap-3">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <label className="text-xs text-muted-foreground">Proyek</label>
          <select
            value={projIndex}
            onChange={(e) => setProjIndex(Number(e.target.value))}
            className="h-8 rounded-md border bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-ring"
          >
            {projects.map((p, i) => (
              <option key={p.projectCode} value={i}>
                {p.projectName} ({p.projectCode})
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Percent className="h-4 w-4 text-sky-500" />
                Pajak
              </CardTitle>
              <CardDescription>Master Tax Engine</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <Row label="Jenis" value={<Badge variant="info">{tax.code}</Badge>} />
              <Row label="Label" value={tax.label} />
              <Row label="Tarif" value={<span className="font-semibold tabular-nums">{pct(tax.rate)}</span>} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-amber-500" />
                Penalty Keterlambatan
              </CardTitle>
              <CardDescription>Per bulan overdue</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <Row
                label="Tarif / bulan"
                value={<span className="font-semibold tabular-nums">{pct(penalty.monthlyRate)}</span>}
              />
              <Row label="Grace period" value={`${penalty.graceDays} hari`} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Fuel className="h-4 w-4 text-emerald-500" />
                Surcharge BBM
              </CardTitle>
              <CardDescription>Bahan bakar</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <Row
                label="Berlaku"
                value={<Badge variant={bbm.applies ? "success" : "muted"}>{bbm.applies ? "Ya" : "Tidak"}</Badge>}
              />
              <Row
                label="Kena pajak"
                value={<Badge variant={bbm.taxable ? "info" : "muted"}>{bbm.taxable ? "Ya" : "Tidak"}</Badge>}
              />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FunctionSquare className="h-4 w-4 text-primary" />
              Rumus Efektif — {project.projectName}
            </CardTitle>
            <CardDescription>Rumus tersusun otomatis dari parameter di atas (config-driven).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <FormulaRow icon={Receipt} label="Net Invoice" formula={netFormula} />
            <FormulaRow icon={Clock} label="Penalty" formula={penaltyFormula} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm">{value}</span>
    </div>
  );
}

function FormulaRow({
  icon: Icon,
  label,
  formula,
}: {
  icon: typeof Receipt;
  label: string;
  formula: string;
}) {
  return (
    <div className="rounded-md border bg-muted/20 p-3">
      <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <code className="block whitespace-pre-wrap break-words font-mono text-xs">{formula}</code>
    </div>
  );
}
