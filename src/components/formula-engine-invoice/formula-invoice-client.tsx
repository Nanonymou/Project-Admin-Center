"use client";

import { useEffect, useMemo, useState } from "react";
import { Calculator, FileText, Fuel, Percent, AlertTriangle, MapPin } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePersona } from "@/components/providers/persona-provider";
import { canAccessProject } from "@/lib/personas";
import { cn, formatCurrency, terbilang } from "@/lib/utils";
import { MOCK_WORKSPACES } from "@/lib/mock/workspaces";
import { computeInvoice } from "@/lib/server/services/invoice-calculation-service";
import { getBbmConfig } from "@/lib/mock/bbm-config";

/** Invoice types — each profiles the mock financial inputs differently. */
const INVOICE_TYPES = [
  { key: "meals", label: "Jasa Katering (Meals)", subtotal: 1, deduction: 0.02, bbm: 0 },
  { key: "meals_bbm", label: "Katering + BBM", subtotal: 1.1, deduction: 0.02, bbm: 1 },
  { key: "backcharge", label: "Dengan Backcharge", subtotal: 1, deduction: 0.12, bbm: 0 },
  { key: "full", label: "Kontrak Penuh", subtotal: 1.6, deduction: 0.04, bbm: 0.5 },
] as const;
type InvoiceType = (typeof INVOICE_TYPES)[number]["key"];

/**
 * Deterministic mock invoice inputs per project & invoice type (config drives the
 * formula; the type scales the base amounts). BBM is only populated when the
 * project's config enables it.
 */
function mockInvoiceInput(projectCode: string, locationId: string, type: InvoiceType) {
  let h = 0;
  for (let i = 0; i < locationId.length; i++) h = (h * 31 + locationId.charCodeAt(i)) & 0xffffffff;
  const seed = Math.abs(h);
  const profile = INVOICE_TYPES.find((t) => t.key === type) ?? INVOICE_TYPES[0];
  const baseSubtotal = 80_000_000 + (seed % 40) * 1_000_000;
  const subtotal = Math.round(baseSubtotal * profile.subtotal);
  const deduction = Math.round(subtotal * profile.deduction);
  const bbm = getBbmConfig(projectCode).applies
    ? Math.round((5_000_000 + (seed % 8) * 500_000) * profile.bbm)
    : 0;
  const overdueDays = (seed % 4) * 20; // 0, 20, 40, 60
  return { projectCode, subtotal, deduction, bbm, overdueDays };
}

export function FormulaInvoiceClient() {
  const { persona } = usePersona();

  const workspaces = useMemo(
    () => MOCK_WORKSPACES.filter((w) => canAccessProject(persona, w.projectCode)),
    [persona],
  );
  const [wsIndex, setWsIndex] = useState(0);
  const ws = workspaces[wsIndex] ?? workspaces[0];
  const [invoiceType, setInvoiceType] = useState<InvoiceType>("meals");

  const seed = useMemo(
    () => (ws ? mockInvoiceInput(ws.projectCode, ws.locationId, invoiceType) : null),
    [ws, invoiceType],
  );

  // Editable inputs — seeded from the mock, recalculated live as they change.
  const [subtotal, setSubtotal] = useState(0);
  const [deduction, setDeduction] = useState(0);
  const [bbm, setBbm] = useState(0);
  const [overdueDays, setOverdueDays] = useState(0);

  // Reset editable values whenever the workspace or invoice type changes.
  useEffect(() => {
    if (!seed) return;
    setSubtotal(seed.subtotal);
    setDeduction(seed.deduction);
    setBbm(seed.bbm);
    setOverdueDays(seed.overdueDays);
  }, [seed]);

  const input = ws
    ? { projectCode: ws.projectCode, subtotal, deduction, bbm, overdueDays }
    : null;
  const calc = useMemo(() => (input ? computeInvoice(input) : null), [
    input?.projectCode,
    subtotal,
    deduction,
    bbm,
    overdueDays,
  ]);
  const bbmCfg = ws ? getBbmConfig(ws.projectCode) : null;

  if (!ws || !input || !calc) {
    return (
      <div>
        <PageHeader title="Formula Engine Invoice" description="Rincian perhitungan invoice per formula config." />
        <div className="p-6 text-sm text-muted-foreground">Tidak ada project dalam cakupan Anda.</div>
      </div>
    );
  }

  const invoiceNo = `INV/${new Date().getFullYear()}/${ws.projectCode}/${String(wsIndex + 1).padStart(4, "0")}`;

  const steps = [
    { label: "Subtotal jasa", value: calc.subtotal, icon: FileText, sign: "" as const },
    { label: "Pengurang (backcharge)", value: -calc.deduction, icon: FileText, sign: "minus" as const, hide: calc.deduction === 0 },
    { label: "Base (subtotal − pengurang)", value: calc.base, icon: FileText, sign: "sub" as const },
    { label: `BBM surcharge${bbmCfg?.applies ? "" : " (nonaktif)"}`, value: calc.bbmAmount, icon: Fuel, sign: "" as const, hide: !bbmCfg?.applies },
    { label: "Base kena pajak", value: calc.taxableBase, icon: FileText, sign: "sub" as const },
    { label: `${calc.taxLabel}`, value: calc.taxAmount, icon: Percent, sign: "" as const },
    { label: `Penalty (${(calc.penaltyRate * 100).toFixed(1)}%/bln × ${calc.penaltyMonths} bln)`, value: calc.penaltyAmount, icon: AlertTriangle, sign: "" as const, hide: calc.penaltyMonths === 0 },
  ];

  return (
    <div>
      <PageHeader
        title="Formula Engine Invoice"
        description="Rincian perhitungan invoice sesuai formula config per project (PPN/PB1, BBM, penalty)."
        breadcrumbs={[{ label: "Operasional" }, { label: "Formula Engine Invoice" }]}
      />

      <div className="space-y-6 p-4 md:p-6">
        <PersonaBanner persona={persona} scopeSummary={`${workspaces.length} workspace`} />

        <div className="flex flex-wrap items-center gap-3">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <label className="text-xs text-muted-foreground">Workspace</label>
          <select
            value={wsIndex}
            onChange={(e) => setWsIndex(Number(e.target.value))}
            className="h-8 rounded-md border bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-ring"
          >
            {workspaces.map((w, i) => (
              <option key={w.locationId} value={i}>
                {w.projectCode} — {w.locationName}
              </option>
            ))}
          </select>
          <label className="text-xs text-muted-foreground">Jenis Invoice</label>
          <select
            value={invoiceType}
            onChange={(e) => setInvoiceType(e.target.value as InvoiceType)}
            className="h-8 rounded-md border bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-ring"
          >
            {INVOICE_TYPES.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
          <Badge variant="info">{calc.taxLabel}</Badge>
          {bbmCfg?.applies && <Badge variant="warning">BBM aktif</Badge>}
        </div>

        {/* Editable inputs — formula recomputes live */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Input Nilai (otomatis dihitung)</CardTitle>
            <CardDescription>Ubah nilai — total dihitung ulang seketika.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="flex flex-col gap-1 text-xs">
                <span className="text-muted-foreground">Subtotal jasa (Rp)</span>
                <input
                  type="number"
                  min={0}
                  step={1_000_000}
                  value={subtotal}
                  onChange={(e) => setSubtotal(Math.max(0, Number(e.target.value) || 0))}
                  className="h-9 rounded-md border bg-background px-2 text-right text-sm tabular-nums outline-none focus:ring-2 focus:ring-ring"
                />
                <span className="text-right text-[11px] tabular-nums text-muted-foreground">
                  {formatCurrency(subtotal)}
                </span>
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="text-muted-foreground">Pengurang / backcharge (Rp)</span>
                <input
                  type="number"
                  min={0}
                  step={500_000}
                  value={deduction}
                  onChange={(e) => setDeduction(Math.max(0, Number(e.target.value) || 0))}
                  className="h-9 rounded-md border bg-background px-2 text-right text-sm tabular-nums outline-none focus:ring-2 focus:ring-ring"
                />
                <span className="text-right text-[11px] tabular-nums text-muted-foreground">
                  {formatCurrency(deduction)}
                </span>
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="text-muted-foreground">
                  BBM surcharge (Rp){!bbmCfg?.applies && " — nonaktif"}
                </span>
                <input
                  type="number"
                  min={0}
                  step={500_000}
                  value={bbm}
                  disabled={!bbmCfg?.applies}
                  onChange={(e) => setBbm(Math.max(0, Number(e.target.value) || 0))}
                  className="h-9 rounded-md border bg-background px-2 text-right text-sm tabular-nums outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                />
                <span className="text-right text-[11px] tabular-nums text-muted-foreground">
                  {formatCurrency(bbmCfg?.applies ? bbm : 0)}
                </span>
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="text-muted-foreground">Hari terlambat</span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={overdueDays}
                  onChange={(e) => setOverdueDays(Math.max(0, Number(e.target.value) || 0))}
                  className="h-9 rounded-md border bg-background px-2 text-right text-sm tabular-nums outline-none focus:ring-2 focus:ring-ring"
                />
              </label>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Formula breakdown */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-4 w-4 text-primary" />
                Rincian Formula
              </CardTitle>
              <CardDescription>
                {invoiceNo} · {ws.projectName} · {ws.locationName}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <tbody>
                  {steps
                    .filter((s) => !s.hide)
                    .map((s) => {
                      const Icon = s.icon;
                      return (
                        <tr
                          key={s.label}
                          className={cn("border-b last:border-0", s.sign === "sub" && "bg-muted/30 font-medium")}
                        >
                          <td className="px-4 py-2.5">
                            <span className="inline-flex items-center gap-2">
                              <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                              {s.label}
                            </span>
                          </td>
                          <td
                            className={cn(
                              "px-4 py-2.5 text-right tabular-nums",
                              s.sign === "minus" && "text-rose-600",
                            )}
                          >
                            {formatCurrency(s.value)}
                          </td>
                        </tr>
                      );
                    })}
                  <tr className="border-t-2 bg-primary/5">
                    <td className="px-4 py-3 text-base font-semibold">Total Invoice</td>
                    <td className="px-4 py-3 text-right text-base font-bold tabular-nums text-primary">
                      {formatCurrency(calc.total)}
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={2} className="px-4 py-2 text-right text-[11px] capitalize italic text-muted-foreground">
                      {terbilang(calc.total)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Config panel */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Konfigurasi Formula</CardTitle>
              <CardDescription>Nilai config yang menggerakkan perhitungan.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pajak</span>
                <span className="font-medium">{calc.taxLabel}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">BBM surcharge</span>
                <span className="font-medium">{bbmCfg?.applies ? "Aktif" : "Nonaktif"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">BBM kena pajak</span>
                <span className="font-medium">{bbmCfg?.taxable ? "Ya" : "Tidak"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Penalty / bulan</span>
                <span className="font-medium">{(calc.penaltyRate * 100).toFixed(1)}%</span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span className="text-muted-foreground">Overdue</span>
                <span className="font-medium">{input.overdueDays} hari</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
