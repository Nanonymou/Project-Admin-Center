"use client";

import { useMemo, useState } from "react";
import { FunctionSquare, Building2, Receipt, Clock, Plus, Pencil, Ban, RotateCcw, Calculator } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { usePersona } from "@/components/providers/persona-provider";
import { formatCurrency } from "@/lib/utils";
import { canAccessProject } from "@/lib/personas";
import { MOCK_WORKSPACES } from "@/lib/mock/workspaces";
import { getTaxConfig } from "@/lib/mock/tax-config";
import { getPenaltyConfig } from "@/lib/mock/penalty-config";
import { getBbmConfig } from "@/lib/mock/bbm-config";

/** A calculation parameter feeding the formula engine. */
type ParamType = "percent" | "days" | "flag" | "flat";
type CalcParam = {
  key: string;
  label: string;
  group: string;
  type: ParamType;
  value: number; // flags stored as 0/1
  builtin: boolean;
};

const TYPE_LABEL: Record<ParamType, string> = {
  percent: "Persen",
  days: "Hari",
  flag: "Ya/Tidak",
  flat: "Nominal",
};

const pct = (f: number) => `${(f * 100).toFixed((f * 100) % 1 === 0 ? 0 : 1)}%`;

function formatValue(p: CalcParam): string {
  switch (p.type) {
    case "percent":
      return pct(p.value);
    case "days":
      return `${p.value} hari`;
    case "flag":
      return p.value ? "Ya" : "Tidak";
    default:
      return new Intl.NumberFormat("id-ID").format(p.value);
  }
}

/**
 * Formula Engine — the config-driven registry of financial calculation
 * parameters per project (PRD §Formula Builder / Tax Engine). Built-in
 * parameters are seeded from the tax / penalty / BBM config; leaders/super
 * admins can add custom parameters, edit values, and deactivate them
 * (session-local). The Net Invoice / Penalty formulas are composed from the
 * active parameter values — no hardcoded per-project branches. Persona-scoped.
 */
export function FormulaEngineClient() {
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

  // Session-local: custom params, value overrides, and deactivated keys per project.
  const [customParams, setCustomParams] = useState<Record<string, CalcParam[]>>({});
  const [valueOverrides, setValueOverrides] = useState<Record<string, Record<string, number>>>({});
  const [inactive, setInactive] = useState<Record<string, string[]>>({});

  const baseParams: CalcParam[] = useMemo(() => {
    if (!project) return [];
    const tax = getTaxConfig(project.projectCode);
    const penalty = getPenaltyConfig(project.projectCode);
    const bbm = getBbmConfig(project.projectCode);
    return [
      { key: "tax_rate", label: `${tax.code} — Tarif Pajak`, group: "Pajak", type: "percent", value: tax.rate, builtin: true },
      { key: "penalty_rate", label: "Penalty per Bulan", group: "Penalty", type: "percent", value: penalty.monthlyRate, builtin: true },
      { key: "penalty_grace", label: "Grace Period", group: "Penalty", type: "days", value: penalty.graceDays, builtin: true },
      { key: "bbm_applies", label: "BBM Berlaku", group: "BBM", type: "flag", value: bbm.applies ? 1 : 0, builtin: true },
      { key: "bbm_taxable", label: "BBM Kena Pajak", group: "BBM", type: "flag", value: bbm.taxable ? 1 : 0, builtin: true },
    ];
  }, [project]);

  const projOverrides = valueOverrides[projectCode] ?? {};
  const projInactive = inactive[projectCode] ?? [];
  const isInactive = (key: string) => projInactive.includes(key);
  const isEdited = (key: string) => key in projOverrides;

  const params: CalcParam[] = useMemo(() => {
    const merged = [...baseParams, ...(customParams[projectCode] ?? [])];
    return merged.map((p) => (p.key in projOverrides ? { ...p, value: projOverrides[p.key] } : p));
  }, [baseParams, customParams, projectCode, projOverrides]);

  const valueOf = (key: string) => params.find((p) => p.key === key)?.value ?? 0;
  const activeValue = (key: string) => (isInactive(key) ? 0 : valueOf(key));

  // Form state.
  const [formOpen, setFormOpen] = useState(false);
  const [editKey, setEditKey] = useState<string | null>(null);
  const [editType, setEditType] = useState<ParamType>("percent");
  const [formLabel, setFormLabel] = useState("");
  const [formGroup, setFormGroup] = useState("");
  const [formType, setFormType] = useState<ParamType>("percent");
  const [formValue, setFormValue] = useState("");

  function openAdd() {
    setEditKey(null);
    setFormLabel("");
    setFormGroup("");
    setFormType("percent");
    setFormValue("");
    setFormOpen(true);
  }

  function openEdit(p: CalcParam) {
    setEditKey(p.key);
    setEditType(p.type);
    setFormLabel(p.label);
    setFormGroup(p.group);
    setFormType(p.type);
    // percent shown as whole number for editing convenience
    setFormValue(p.type === "percent" ? String(Math.round(p.value * 1000) / 10) : String(p.value));
  }

  /** Convert the raw form input into the stored numeric value for a type. */
  function toStored(type: ParamType, raw: string): number {
    const n = Number(raw) || 0;
    if (type === "percent") return Math.max(0, n / 100);
    if (type === "flag") return n ? 1 : 0;
    return Math.max(0, n);
  }

  function saveForm() {
    const label = formLabel.trim();
    if (!editKey && !label) return;
    if (editKey) {
      setValueOverrides((prev) => ({
        ...prev,
        [projectCode]: { ...(prev[projectCode] ?? {}), [editKey]: toStored(editType, formValue) },
      }));
    } else {
      const key = `custom_${label.toLowerCase().replace(/[^a-z0-9]+/g, "_")}_${Date.now()}`;
      const param: CalcParam = {
        key,
        label,
        group: formGroup.trim() || "Lainnya",
        type: formType,
        value: toStored(formType, formValue),
        builtin: false,
      };
      setCustomParams((prev) => ({ ...prev, [projectCode]: [...(prev[projectCode] ?? []), param] }));
    }
    setFormOpen(false);
  }

  function toggleActive(key: string) {
    setInactive((prev) => {
      const cur = prev[projectCode] ?? [];
      const next = cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key];
      return { ...prev, [projectCode]: next };
    });
  }

  // Live calculation simulation inputs.
  const [simGross, setSimGross] = useState("100000000");
  const [simBackcharge, setSimBackcharge] = useState("2000000");
  const [simBbm, setSimBbm] = useState("5000000");
  const [simOverdue, setSimOverdue] = useState("45");

  if (!project) {
    return (
      <div>
        <PageHeader title="Formula Engine" description="Konfigurasi formula per proyek." />
        <div className="p-6 text-sm text-muted-foreground">Tidak ada proyek dalam cakupan Anda.</div>
      </div>
    );
  }

  const taxCode = getTaxConfig(project.projectCode).code;
  const bbmOn = activeValue("bbm_applies") === 1;
  const bbmTaxable = activeValue("bbm_taxable") === 1;
  const taxRate = activeValue("tax_rate");
  const penaltyRate = activeValue("penalty_rate");
  const graceDays = activeValue("penalty_grace");
  const netFormula = `Net Invoice = (Gross − Backcharge${bbmOn ? " + BBM" : ""}) × (1 + ${taxCode} ${pct(taxRate)})`;
  const penaltyFormula = `Penalty = ceil((hari overdue − ${graceDays}) / 30) × ${pct(penaltyRate)} × Net`;

  // Compute the sample calculation from the current active parameter values.
  const num = (s: string) => Math.max(0, Number(s) || 0);
  const gross = num(simGross);
  const backcharge = num(simBackcharge);
  const bbmAmount = bbmOn ? num(simBbm) : 0;
  const subtotal = gross - backcharge;
  const preTax = subtotal + bbmAmount;
  const taxableBase = subtotal + (bbmTaxable ? bbmAmount : 0);
  const taxAmount = Math.round(taxableBase * taxRate);
  const netInvoice = preTax + taxAmount;
  const overdueMonths = Math.max(0, Math.ceil((num(simOverdue) - graceDays) / 30));
  const penaltyAmount = Math.round(overdueMonths * penaltyRate * netInvoice);
  const grandTotal = netInvoice + penaltyAmount;

  return (
    <div>
      <PageHeader
        title="Formula Engine"
        description="Registry parameter perhitungan finansial per proyek (config-driven)."
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
          {editable && (
            <Button size="sm" onClick={openAdd} className="ml-auto gap-1.5">
              <Plus className="h-4 w-4" />
              Tambah Parameter
            </Button>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FunctionSquare className="h-4 w-4 text-primary" />
              Parameter Perhitungan — {project.projectName}
            </CardTitle>
            <CardDescription>Nilai parameter yang menyusun rumus finansial proyek ini.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Parameter</th>
                    <th className="px-3 py-2 font-medium">Grup</th>
                    <th className="px-3 py-2 font-medium">Tipe</th>
                    <th className="px-3 py-2 text-right font-medium">Nilai</th>
                    {editable && <th className="px-3 py-2 text-right font-medium">Aksi</th>}
                  </tr>
                </thead>
                <tbody>
                  {params.map((p) => {
                    const off = isInactive(p.key);
                    return (
                      <tr key={p.key} className={`border-b last:border-b-0 ${off ? "opacity-50" : ""}`}>
                        <td className="px-3 py-2 font-medium">
                          <span className={off ? "line-through" : ""}>{p.label}</span>
                          {!p.builtin && <Badge variant="success" className="ml-2">Kustom</Badge>}
                          {isEdited(p.key) && <Badge variant="warning" className="ml-2">Diubah</Badge>}
                          {off && <Badge variant="danger" className="ml-2">Nonaktif</Badge>}
                        </td>
                        <td className="px-3 py-2 text-xs">{p.group}</td>
                        <td className="px-3 py-2">
                          <Badge variant="muted">{TYPE_LABEL[p.type]}</Badge>
                        </td>
                        <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatValue(p)}</td>
                        {editable && (
                          <td className="px-3 py-2 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEdit(p)}
                                disabled={off}
                                className="h-7 gap-1 px-2"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                                Ubah
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleActive(p.key)}
                                className={`h-7 gap-1 px-2 ${off ? "text-emerald-600" : "text-rose-600"}`}
                              >
                                {off ? (
                                  <>
                                    <RotateCcw className="h-3.5 w-3.5" />
                                    Aktifkan
                                  </>
                                ) : (
                                  <>
                                    <Ban className="h-3.5 w-3.5" />
                                    Nonaktifkan
                                  </>
                                )}
                              </Button>
                            </div>
                          </td>
                        )}
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
            <CardTitle className="flex items-center gap-2 text-base">
              <FunctionSquare className="h-4 w-4 text-primary" />
              Rumus Efektif
            </CardTitle>
            <CardDescription>Tersusun otomatis dari parameter aktif di atas.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <FormulaRow icon={Receipt} label="Net Invoice" formula={netFormula} />
            <FormulaRow icon={Clock} label="Penalty" formula={penaltyFormula} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calculator className="h-4 w-4 text-primary" />
              Simulasi Perhitungan
            </CardTitle>
            <CardDescription>
              Ubah input untuk melihat hasil memakai parameter aktif proyek ini.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <SimInput label="Gross Sales" value={simGross} onChange={setSimGross} />
              <SimInput label="Backcharge" value={simBackcharge} onChange={setSimBackcharge} />
              <SimInput label="BBM" value={simBbm} onChange={setSimBbm} disabled={!bbmOn} />
              <SimInput label="Hari Overdue" value={simOverdue} onChange={setSimOverdue} />
            </div>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <tbody>
                  <ResultRow label="Subtotal (Gross − Backcharge)" value={formatCurrency(subtotal)} />
                  {bbmOn && <ResultRow label="BBM Surcharge" value={formatCurrency(bbmAmount)} />}
                  <ResultRow label={`Dasar Pajak`} value={formatCurrency(taxableBase)} />
                  <ResultRow label={`Pajak (${taxCode} ${pct(taxRate)})`} value={formatCurrency(taxAmount)} />
                  <ResultRow label="Net Invoice" value={formatCurrency(netInvoice)} strong />
                  <ResultRow
                    label={`Penalty (${overdueMonths} bln × ${pct(penaltyRate)})`}
                    value={penaltyAmount > 0 ? `+ ${formatCurrency(penaltyAmount)}` : formatCurrency(0)}
                    tone={penaltyAmount > 0 ? "text-rose-600" : undefined}
                  />
                  <ResultRow label="Total Tagihan" value={formatCurrency(grandTotal)} strong />
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editKey ? "Ubah Parameter" : "Tambah Parameter"}
        description={`Parameter perhitungan untuk proyek ${project.projectName}.`}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setFormOpen(false)}>
              Batal
            </Button>
            <Button size="sm" onClick={saveForm} disabled={!editKey && !formLabel.trim()}>
              Simpan
            </Button>
          </div>
        }
      >
        <div className="space-y-3 text-sm">
          {!editKey && (
            <>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Nama Parameter</label>
                <Input value={formLabel} onChange={(e) => setFormLabel(e.target.value)} placeholder="mis. Management Fee" className="h-9" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Grup</label>
                  <Input value={formGroup} onChange={(e) => setFormGroup(e.target.value)} placeholder="mis. Fee" className="h-9" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Tipe</label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as ParamType)}
                    className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="percent">Persen</option>
                    <option value="flat">Nominal</option>
                    <option value="days">Hari</option>
                    <option value="flag">Ya/Tidak</option>
                  </select>
                </div>
              </div>
            </>
          )}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Nilai{" "}
              {(editKey ? editType : formType) === "percent"
                ? "(%)"
                : (editKey ? editType : formType) === "flag"
                  ? "(1 = Ya, 0 = Tidak)"
                  : ""}
            </label>
            <Input
              type="number"
              min={0}
              value={formValue}
              onChange={(e) => setFormValue(e.target.value)}
              placeholder="0"
              className="h-9 tabular-nums"
            />
          </div>
        </div>
      </Dialog>
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

function SimInput({
  label,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <Input
        type="number"
        min={0}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 tabular-nums"
      />
    </div>
  );
}

function ResultRow({
  label,
  value,
  strong = false,
  tone,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: string;
}) {
  return (
    <tr className="border-b last:border-0">
      <td className={`px-3 py-2 ${strong ? "font-semibold" : "text-muted-foreground"}`}>{label}</td>
      <td className={`px-3 py-2 text-right tabular-nums ${strong ? "font-semibold" : ""} ${tone ?? ""}`}>
        {value}
      </td>
    </tr>
  );
}
