"use client";

import { useMemo, useState } from "react";
import { FileText, Fuel, Percent, Minus, Plus, Pencil, Ban, RotateCcw } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { InvoiceTypeSelect } from "@/components/jenis-invoice/invoice-type-select";
import { usePersona } from "@/components/providers/persona-provider";
import { type Persona } from "@/lib/personas";
import { listInvoiceTypes, type InvoiceTypeProfile } from "@/lib/mock/invoice-type-config";

type InvoiceTypeRow = InvoiceTypeProfile & { custom?: boolean; active: boolean };
type TypeOverride = Partial<Pick<InvoiceTypeProfile, "label" | "deductionRate" | "hasBbm" | "bbmRate">>;

/** Render a fraction (0..1) as a percentage string, e.g. 0.06 → "6%". */
function pct(fraction: number): string {
  return `${(fraction * 100).toFixed((fraction * 100) % 1 === 0 ? 0 : 1)}%`;
}

/** Site admins/leaders can manage invoice types; viewers get a read-only list. */
function canEditTypes(persona: Persona): boolean {
  return persona.role !== "viewer";
}

/**
 * Jenis Invoice — the config-driven catalogue of invoice type profiles
 * (`invoice-type-config.ts`). Each profile shapes how an invoice's financial
 * inputs are derived: the default deduction rate and whether a BBM (fuel)
 * surcharge participates. Leaders/admins can add, rename, and activate/
 * deactivate types (session-local). Type profiles stay generic (no
 * project-named entries) so they remain reusable across every project.
 */
export function JenisInvoiceClient() {
  const { persona } = usePersona();
  const editable = canEditTypes(persona);

  // Session-local state: custom types, field overrides on any type, and the
  // deactivated key set.
  const [customTypes, setCustomTypes] = useState<(InvoiceTypeProfile & { custom: true })[]>([]);
  const [overrides, setOverrides] = useState<Record<string, TypeOverride>>({});
  const [inactive, setInactive] = useState<string[]>([]);

  const types = useMemo<InvoiceTypeRow[]>(() => {
    const base: InvoiceTypeRow[] = [...listInvoiceTypes(), ...customTypes].map((t) => {
      const ov = overrides[t.key] ?? {};
      return {
        key: t.key,
        label: ov.label ?? t.label,
        deductionRate: ov.deductionRate ?? t.deductionRate,
        hasBbm: ov.hasBbm ?? t.hasBbm,
        bbmRate: ov.bbmRate ?? t.bbmRate,
        custom: (t as { custom?: boolean }).custom ?? false,
        active: !inactive.includes(t.key),
      };
    });
    return base;
  }, [customTypes, overrides, inactive]);

  const activeTypes = useMemo(() => types.filter((t) => t.active), [types]);
  const activeCount = activeTypes.length;
  const isEdited = (key: string) => key in overrides;

  // Preview selector — demonstrates the active-only dropdown consumed by
  // invoice-creation flows. Falls back to the first active type if the current
  // pick was deactivated.
  const [previewKey, setPreviewKey] = useState("");
  const selectedKey = activeTypes.some((t) => t.key === previewKey)
    ? previewKey
    : activeTypes[0]?.key ?? "";
  const selectedType = activeTypes.find((t) => t.key === selectedKey);

  // Form state.
  const [formOpen, setFormOpen] = useState(false);
  const [editKey, setEditKey] = useState<string | null>(null); // null = add new
  const [formLabel, setFormLabel] = useState("");
  const [formDeduction, setFormDeduction] = useState("");
  const [formHasBbm, setFormHasBbm] = useState(false);
  const [formBbm, setFormBbm] = useState("");

  function openAdd() {
    setEditKey(null);
    setFormLabel("");
    setFormDeduction("");
    setFormHasBbm(false);
    setFormBbm("");
    setFormOpen(true);
  }

  function openEdit(t: InvoiceTypeRow) {
    setEditKey(t.key);
    setFormLabel(t.label);
    setFormDeduction(String(Math.round(t.deductionRate * 1000) / 10));
    setFormHasBbm(t.hasBbm);
    setFormBbm(String(Math.round(t.bbmRate * 1000) / 10));
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
    const bbmRate = formHasBbm ? parsePct(formBbm) : 0;
    const fields: TypeOverride = {
      label,
      deductionRate: parsePct(formDeduction),
      hasBbm: formHasBbm,
      bbmRate,
    };
    if (editKey) {
      setOverrides((prev) => ({ ...prev, [editKey]: { ...prev[editKey], ...fields } }));
    } else {
      const key = `custom_${label.toLowerCase().replace(/[^a-z0-9]+/g, "_")}_${Date.now()}`;
      setCustomTypes((prev) => [
        ...prev,
        { key, label, deductionRate: fields.deductionRate!, hasBbm: formHasBbm, bbmRate, custom: true },
      ]);
    }
    setFormOpen(false);
  }

  function toggleActive(key: string) {
    setInactive((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
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
          <Badge variant="default" className="ml-auto">
            {activeCount} aktif / {types.length}
          </Badge>
          {editable && (
            <Button size="sm" onClick={openAdd} className="gap-1.5">
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
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Jenis Invoice</th>
                    <th className="px-3 py-2 font-medium">Kode</th>
                    <th className="px-3 py-2 text-right font-medium">Potongan Default</th>
                    <th className="px-3 py-2 font-medium">BBM Surcharge</th>
                    {editable && <th className="px-3 py-2 text-right font-medium">Aksi</th>}
                  </tr>
                </thead>
                <tbody>
                  {types.map((t) => (
                    <tr key={t.key} className={`border-b last:border-b-0 ${t.active ? "" : "opacity-50"}`}>
                      <td className="px-3 py-2 font-medium">
                        <span className={t.active ? "" : "line-through"}>{t.label}</span>
                        {t.custom && (
                          <Badge variant="success" className="ml-2">
                            Kustom
                          </Badge>
                        )}
                        {!t.custom && isEdited(t.key) && (
                          <Badge variant="warning" className="ml-2">
                            Diubah
                          </Badge>
                        )}
                        {!t.active && (
                          <Badge variant="danger" className="ml-2">
                            Nonaktif
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
                      {editable && (
                        <td className="px-3 py-2 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEdit(t)}
                              disabled={!t.active}
                              className="h-7 gap-1 px-2"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Ubah
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleActive(t.key)}
                              className={`h-7 gap-1 px-2 ${t.active ? "text-rose-600" : "text-emerald-600"}`}
                            >
                              {t.active ? (
                                <>
                                  <Ban className="h-3.5 w-3.5" />
                                  Nonaktifkan
                                </>
                              ) : (
                                <>
                                  <RotateCcw className="h-3.5 w-3.5" />
                                  Aktifkan
                                </>
                              )}
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Pratinjau Pemilihan Jenis</CardTitle>
            <CardDescription>
              Dropdown ini hanya menampilkan jenis yang aktif — sama seperti saat membuat invoice.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="max-w-xs">
              <InvoiceTypeSelect types={activeTypes} value={selectedKey} onChange={setPreviewKey} />
            </div>
            {selectedType ? (
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="secondary" className="font-mono">
                  {selectedType.key}
                </Badge>
                <Badge variant="warning" className="gap-1">
                  <Minus className="h-3 w-3" />
                  Potongan {pct(selectedType.deductionRate)}
                </Badge>
                {selectedType.hasBbm ? (
                  <Badge variant="info" className="gap-1">
                    <Fuel className="h-3 w-3" />
                    BBM {pct(selectedType.bbmRate)}
                  </Badge>
                ) : (
                  <Badge variant="muted">Tanpa BBM</Badge>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Tidak ada jenis aktif. Aktifkan minimal satu jenis di daftar di atas.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editKey ? "Ubah Jenis Invoice" : "Tambah Jenis Invoice"}
        description="Perbarui nama dan parameter jenis invoice. Nilai dalam persen dari subtotal."
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
