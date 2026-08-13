"use client";

import { useMemo, useState } from "react";
import { Landmark, Building2, Percent, Check } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePersona } from "@/components/providers/persona-provider";
import { canAccessProject } from "@/lib/personas";
import { MOCK_WORKSPACES } from "@/lib/mock/workspaces";
import { getTaxConfig } from "@/lib/mock/tax-config";
import { listTaxTypes, TAX_CATEGORY_META, type TaxType } from "@/lib/mock/tax-master";

const pct = (f: number) => `${(f * 100).toFixed((f * 100) % 1 === 0 ? 0 : 1)}%`;

/**
 * Konfigurasi Pajak per Project — activates which tax types apply to each
 * project (PRD §Master Tax Engine: taxes defined centrally, activated per
 * project for regional flexibility). The default active tax is derived from the
 * per-project tax config; leaders/super admins toggle additional taxes on/off
 * (session-local). Persona-scoped by project access.
 */
export function TaxPerProjectClient() {
  const { persona } = usePersona();
  const editable = persona.capabilities.canConfigure;

  const projects = useMemo(() => {
    const map = new Map<string, string>();
    for (const w of MOCK_WORKSPACES) {
      if (canAccessProject(persona, w.projectCode)) map.set(w.projectCode, w.projectName);
    }
    return [...map].map(([projectCode, projectName]) => ({ projectCode, projectName }));
  }, [persona]);

  const [projIndex, setProjIndex] = useState(0);
  const project = projects[projIndex] ?? projects[0];
  const projectCode = project?.projectCode ?? "";

  const taxes = listTaxTypes().filter((t) => t.active);

  // Default assignment: the tax code from the per-project tax config is on.
  const defaultCode = project ? getTaxConfig(project.projectCode).code : "";
  const defaultAssigned = useMemo(() => {
    // Map legacy config codes (PPN/PB1) to catalogue codes.
    const match = taxes.find((t) => t.category === defaultCode || t.code.startsWith(defaultCode));
    return match ? [match.code] : [];
  }, [taxes, defaultCode]);

  // Session-local per-project assignment overrides.
  const [assigned, setAssigned] = useState<Record<string, string[]>>({});
  const projectAssigned = assigned[projectCode] ?? defaultAssigned;
  const isOn = (code: string) => projectAssigned.includes(code);

  function toggle(code: string) {
    if (!editable) return;
    setAssigned((prev) => {
      const cur = prev[projectCode] ?? defaultAssigned;
      const next = cur.includes(code) ? cur.filter((c) => c !== code) : [...cur, code];
      return { ...prev, [projectCode]: next };
    });
  }

  const totalRate = taxes.filter((t) => isOn(t.code)).reduce((sum, t) => sum + t.rate, 0);

  if (!project) {
    return (
      <div>
        <PageHeader title="Pajak per Project" description="Konfigurasi pajak per project." />
        <div className="p-6 text-sm text-muted-foreground">Tidak ada project dalam cakupan Anda.</div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Pajak per Project"
        description="Aktifkan jenis pajak yang berlaku untuk tiap project."
        breadcrumbs={[{ label: "Master Data" }, { label: "Pajak per Project" }]}
      />

      <div className="space-y-6 p-4 md:p-6">
        <PersonaBanner persona={persona} scopeSummary={`${projects.length} project`} />

        <div className="flex flex-wrap items-center gap-3">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <label className="text-xs text-muted-foreground">Project</label>
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
          <Badge variant="info" className="ml-auto gap-1">
            <Percent className="h-3 w-3" />
            Total tarif aktif {pct(totalRate)}
          </Badge>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Landmark className="h-4 w-4 text-primary" />
              Pajak Aktif — {project.projectName}
            </CardTitle>
            <CardDescription>Centang pajak yang dikenakan pada project ini.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {taxes.map((t: TaxType) => {
                const on = isOn(t.code);
                const cat = TAX_CATEGORY_META[t.category];
                return (
                  <label
                    key={t.code}
                    className={`flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5 ${
                      on ? "border-primary/40 bg-primary/5" : "hover:bg-accent"
                    } ${editable ? "" : "cursor-default"}`}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      disabled={!editable}
                      onChange={() => toggle(t.code)}
                      className="h-4 w-4 rounded border-input"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        {t.label}
                        <Badge variant={cat.variant}>{cat.label}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">{t.description}</div>
                    </div>
                    <Badge variant="info" className="gap-1">
                      <Percent className="h-3 w-3" />
                      {pct(t.rate)}
                    </Badge>
                    {on && <Check className="h-4 w-4 text-primary" />}
                  </label>
                );
              })}
            </div>
            {!editable && (
              <p className="mt-3 text-[11px] text-muted-foreground">
                Hanya Leader/Super Admin yang dapat mengubah konfigurasi pajak.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
