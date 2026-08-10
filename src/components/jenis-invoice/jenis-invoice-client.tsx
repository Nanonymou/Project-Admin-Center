"use client";

import { useMemo, useState } from "react";
import { FileText, Fuel, Percent, Minus, Plus } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { usePersona } from "@/components/providers/persona-provider";
import { type Persona } from "@/lib/personas";
import { listInvoiceTypes, type InvoiceTypeProfile } from "@/lib/mock/invoice-type-config";

type InvoiceTypeRow = InvoiceTypeProfile & { custom?: boolean };

/** Render a fraction (0..1) as a percentage string, e.g. 0.06 → "6%". */
function pct(fraction: number): string {
  return `${(fraction * 100).toFixed((fraction * 100) % 1 === 0 ? 0 : 1)}%`;
}

/** Site admins/leaders can add invoice types; viewers get a read-only list. */
function canEditTypes(persona: Persona): boolean {
  return persona.role !== "viewer";
}

/**
 * Jenis Invoice — the config-driven catalogue of invoice type profiles
 * (`invoice-type-config.ts`). Each profile shapes how an invoice's financial
 * inputs are derived: the default deduction rate and whether a BBM (fuel)
 * surcharge participates. Leaders/admins can add new (session-local) types; type
 * profiles are generic (no project-named entries) so they stay reusable across
 * every project.
 */
export function JenisInvoiceClient() {
  const { persona } = usePersona();
  const editable = canEditTypes(persona);

  // Session-local custom types, appended to the config-driven catalogue.
  const [customTypes, setCustomTypes] = useState<InvoiceTypeRow[]>([]);
  const types = useMemo<InvoiceTypeRow[]>(
    () => [...listInvoiceTypes(), ...customTypes],
    [customTypes],
  );

  // Form state.
  const [formOpen, setFormOpen] = useState(false);
  const [formLabel, setFormLabel] = useState("");
  const [formDeduction, setFormDeduction] = useState("");
  const [formHasBbm, setFormHasBbm] = useState(false);
  const [formBbm, setFormBbm] = useState("");

  function openAdd() {
    setFormLabel("");
    setFormDeduction("");
    setFormHasBbm(false);
    setFormBbm("");
    setFormOpen(true);
  }

  /** Parse a percent input (e.g. "6" or "6.5") into a 0..1 fraction, clamped. */
  function parsePct(raw: string): number {
    const n = Number(raw) || 0;
    return Math.min(1, Math.max(0, n / 100));
  }

  function saveForm() {
    const label = formLabel.trim();
    if (!label) return;
    const key = `custom_${label.toLowerCase().replace(/[^a-z0-9]+/g, "_")}_${Date.now()}`;
    const bbmRate = formHasBbm ? parsePct(formBbm) : 0;
    setCustomTypes((prev) => [
      ...prev,
      { key, label, deductionRate: parsePct(formDeduction), hasBbm: formHasBbm, bbmRate, custom: true },
    ]);
    setFormOpen(false);
  }

  return (
    <div>
      <PageHeader
        title="Jenis Invoice"
        description="Profil jenis invoice (config-driven) yang membentuk perhitungan finansial."
        breadcrumbs={[{ label: "Master Data" }, { label: "Jenis Invoice" }]}
      />

      <div className="space-y-6 p-4 md:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <PersonaBanner persona={persona} scopeSummary={`${types.length} jenis`} />
          {editable && (
            <Button size="sm" onClick={openAdd} className="ml-auto gap-1.5">
              <Plus className="h-4 w-4" />
              Tambah Jenis
            </Button>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Daftar Jenis Invoice
            </CardTitle>
            <CardDescription>
              Profil ini menentukan potongan default dan surcharge BBM. Tarif pajak/penalty aktual tetap
              mengikuti konfigurasi per-project.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Jenis Invoice</th>
                    <th className="px-3 py-2 font-medium">Kode</th>
                    <th className="px-3 py-2 text-right font-medium">Potongan Default</th>
                    <th className="px-3 py-2 font-medium">BBM Surcharge</th>
                  </tr>
                </thead>
                <tbody>
                  {types.map((t) => (
                    <tr key={t.key} className="border-b last:border-b-0">
                      <td className="px-3 py-2 font-medium">
                        {t.label}
                        {t.custom && (
                          <Badge variant="success" className="ml-2">
                            Kustom
                          </Badge>
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{t.key}</td>
                      <td className="px-3 py-2 text-right">
                        {t.deductionRate > 0 ? (
                          <Badge variant="warning" className="gap-1">
                            <Minus className="h-3 w-3" />
                            {pct(t.deductionRate)}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {t.hasBbm ? (
                          <Badge variant="info" className="gap-1">
                            <Fuel className="h-3 w-3" />
                            {pct(t.bbmRate)}
                          </Badge>
                        ) : (
                          <Badge variant="muted">Tidak</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {types.map((t) => (
            <Card key={t.key}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{t.label}</CardTitle>
                <CardDescription className="font-mono text-xs">{t.key}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Percent className="h-3.5 w-3.5" />
                    Potongan
                  </span>
                  <span className="font-medium tabular-nums">{pct(t.deductionRate)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Fuel className="h-3.5 w-3.5" />
                    BBM
                  </span>
                  <span className="font-medium tabular-nums">{t.hasBbm ? pct(t.bbmRate) : "—"}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Dialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title="Tambah Jenis Invoice"
        description="Tambahkan profil jenis invoice baru. Nilai dalam persen dari subtotal."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setFormOpen(false)}>
              Batal
            </Button>
            <Button size="sm" onClick={saveForm}>
              Simpan
            </Button>
          </div>
        }
      >
        <div className="space-y-3 text-sm">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Nama Jenis</label>
            <Input
              value={formLabel}
              onChange={(e) => setFormLabel(e.target.value)}
              placeholder="mis. Katering + Laundry"
              className="h-9"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Potongan Default (%)</label>
            <Input
              type="number"
              min={0}
              max={100}
              value={formDeduction}
              onChange={(e) => setFormDeduction(e.target.value)}
              placeholder="mis. 2"
              className="h-9 tabular-nums"
            />
          </div>
          <label className="flex items-center gap-2 pt-1 text-xs font-medium text-muted-foreground">
            <input
              type="checkbox"
              checked={formHasBbm}
              onChange={(e) => setFormHasBbm(e.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            Punya surcharge BBM (bahan bakar)
          </label>
          {formHasBbm && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">BBM Surcharge (%)</label>
              <Input
                type="number"
                min={0}
                max={100}
                value={formBbm}
                onChange={(e) => setFormBbm(e.target.value)}
                placeholder="mis. 6"
                className="h-9 tabular-nums"
              />
            </div>
          )}
        </div>
      </Dialog>
    </div>
  );
}
