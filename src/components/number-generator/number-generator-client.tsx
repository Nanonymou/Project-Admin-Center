"use client";

import { useMemo, useState } from "react";
import { Hash, Repeat, Braces, Plus, Pencil } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { usePersona } from "@/components/providers/persona-provider";
import {
  listNumberFormats,
  generateSample,
  tokensInPattern,
  RESET_PERIOD_LABEL,
  type NumberFormat,
  type ResetPeriod,
} from "@/lib/mock/number-format";

type FormatForm = {
  label: string;
  prefix: string;
  pattern: string;
  seqPadding: string;
  resetPeriod: ResetPeriod;
  nextSeq: string;
};

const EMPTY_FORM: FormatForm = {
  label: "",
  prefix: "",
  pattern: "{PREFIX}/{YYYY}/{MM}/{SEQ}",
  seqPadding: "4",
  resetPeriod: "monthly",
  nextSeq: "1",
};

/**
 * Automatic Number Generator — config-driven per-document numbering formats.
 * Each format renders a number from a token pattern with a live sample; leaders/
 * super admins can add and edit formats (session-local). History and deactivate
 * are a later task. Persona-scoped.
 */
export function NumberGeneratorClient() {
  const { persona } = usePersona();
  const editable = persona.capabilities.canConfigure;

  const [customFormats, setCustomFormats] = useState<NumberFormat[]>([]);
  const [overrides, setOverrides] = useState<Record<string, Partial<NumberFormat>>>({});
  const formats = useMemo(
    () =>
      [...listNumberFormats(), ...customFormats].map((f) =>
        overrides[f.key] ? { ...f, ...overrides[f.key] } : f,
      ),
    [customFormats, overrides],
  );
  const isEdited = (key: string) => key in overrides;

  const [formOpen, setFormOpen] = useState(false);
  const [editKey, setEditKey] = useState<string | null>(null);
  const [form, setForm] = useState<FormatForm>(EMPTY_FORM);
  const setField = <K extends keyof FormatForm>(k: K, v: FormatForm[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  function openAdd() {
    setEditKey(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  }

  function openEdit(f: NumberFormat) {
    setEditKey(f.key);
    setForm({
      label: f.label,
      prefix: f.prefix,
      pattern: f.pattern,
      seqPadding: String(f.seqPadding),
      resetPeriod: f.resetPeriod,
      nextSeq: String(f.nextSeq),
    });
    setFormOpen(true);
  }

  const formValid = form.label.trim().length > 0 && form.prefix.trim().length > 0 && form.pattern.trim().length > 0;

  /** Build a NumberFormat from the current form (for saving or previewing). */
  function buildFromForm(key: string, active: boolean): NumberFormat {
    return {
      key,
      docType: key,
      label: form.label.trim(),
      prefix: form.prefix.trim(),
      pattern: form.pattern.trim(),
      seqPadding: Math.max(1, Math.round(Number(form.seqPadding) || 1)),
      resetPeriod: form.resetPeriod,
      nextSeq: Math.max(1, Math.round(Number(form.nextSeq) || 1)),
      active,
    };
  }

  function saveForm() {
    if (!formValid) return;
    if (editKey) {
      const built = buildFromForm(editKey, formats.find((f) => f.key === editKey)?.active ?? true);
      const { key: _k, docType: _d, ...fields } = built;
      void _k;
      void _d;
      setOverrides((prev) => ({ ...prev, [editKey]: fields }));
    } else {
      const key = `custom_${form.label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_")}_${Date.now()}`;
      setCustomFormats((prev) => [...prev, buildFromForm(key, true)]);
    }
    setFormOpen(false);
  }

  const previewFormat = formValid ? buildFromForm("preview", true) : null;

  return (
    <div>
      <PageHeader
        title="Penomoran Dokumen"
        description="Konfigurasi format nomor otomatis per dokumen (config-driven)."
        breadcrumbs={[{ label: "Master Data" }, { label: "Penomoran Dokumen" }]}
      />

      <div className="space-y-6 p-4 md:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <PersonaBanner persona={persona} scopeSummary={`${formats.length} format`} />
          {editable && (
            <Button size="sm" onClick={openAdd} className="ml-auto gap-1.5">
              <Plus className="h-4 w-4" />
              Tambah Format
            </Button>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Hash className="h-4 w-4 text-primary" />
              Daftar Format Nomor
            </CardTitle>
            <CardDescription>
              Token: {"{PREFIX} {YYYY} {YY} {MM} {DD} {SEQ}"} — nomor dihasilkan otomatis saat dokumen dibuat.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Dokumen</th>
                    <th className="px-3 py-2 font-medium">Pola</th>
                    <th className="px-3 py-2 font-medium">Reset</th>
                    <th className="px-3 py-2 text-right font-medium">Urut Berikut</th>
                    <th className="px-3 py-2 font-medium">Contoh</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    {editable && <th className="px-3 py-2 text-right font-medium">Aksi</th>}
                  </tr>
                </thead>
                <tbody>
                  {formats.map((f) => (
                    <tr key={f.key} className={`border-b last:border-b-0 ${f.active ? "" : "opacity-50"}`}>
                      <td className="px-3 py-2 font-medium">
                        {f.label}
                        {f.key.startsWith("custom_") && <Badge variant="success" className="ml-2">Kustom</Badge>}
                        {isEdited(f.key) && <Badge variant="warning" className="ml-2">Diubah</Badge>}
                        <div className="font-mono text-[11px] text-muted-foreground">{f.prefix}</div>
                      </td>
                      <td className="px-3 py-2">
                        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{f.pattern}</code>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {tokensInPattern(f.pattern).map((t) => (
                            <span key={t} className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                              <Braces className="h-2.5 w-2.5" />
                              {t.replace(/[{}]/g, "")}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant="muted" className="gap-1">
                          <Repeat className="h-3 w-3" />
                          {RESET_PERIOD_LABEL[f.resetPeriod]}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{f.nextSeq}</td>
                      <td className="px-3 py-2">
                        <code className="font-mono text-xs font-semibold text-primary">{generateSample(f)}</code>
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant={f.active ? "success" : "muted"}>{f.active ? "Aktif" : "Nonaktif"}</Badge>
                      </td>
                      {editable && (
                        <td className="px-3 py-2 text-right">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(f)} className="h-7 gap-1 px-2">
                            <Pencil className="h-3.5 w-3.5" />
                            Ubah
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editKey ? "Ubah Format Nomor" : "Tambah Format Nomor"}
        description="Gunakan token {PREFIX} {YYYY} {YY} {MM} {DD} {SEQ} dalam pola."
        className="max-w-lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setFormOpen(false)}>
              Batal
            </Button>
            <Button size="sm" onClick={saveForm} disabled={!formValid}>
              Simpan
            </Button>
          </div>
        }
      >
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Nama Dokumen</label>
              <Input value={form.label} onChange={(e) => setField("label", e.target.value)} placeholder="mis. Delivery Order" className="h-9" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Prefix</label>
              <Input value={form.prefix} onChange={(e) => setField("prefix", e.target.value.toUpperCase())} placeholder="mis. DO" className="h-9" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Pola</label>
            <Input value={form.pattern} onChange={(e) => setField("pattern", e.target.value)} className="h-9 font-mono" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Padding SEQ</label>
              <Input type="number" min={1} value={form.seqPadding} onChange={(e) => setField("seqPadding", e.target.value)} className="h-9 tabular-nums" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Urut Berikut</label>
              <Input type="number" min={1} value={form.nextSeq} onChange={(e) => setField("nextSeq", e.target.value)} className="h-9 tabular-nums" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Reset</label>
              <select
                value={form.resetPeriod}
                onChange={(e) => setField("resetPeriod", e.target.value as ResetPeriod)}
                className="h-9 w-full rounded-md border bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="monthly">Per Bulan</option>
                <option value="yearly">Per Tahun</option>
                <option value="never">Tanpa Reset</option>
              </select>
            </div>
          </div>
          <div className="rounded-md border bg-muted/30 px-3 py-2">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Pratinjau</div>
            <code className="font-mono text-sm font-semibold text-primary">
              {previewFormat ? generateSample(previewFormat) : "—"}
            </code>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
