"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Landmark, Percent, GitCommitVertical, Plus, Pencil, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { usePersona } from "@/components/providers/persona-provider";
import { personaHeaders } from "@/lib/client/notif";
import { formatDateTime } from "@/lib/utils";
import {
  listTaxTypes,
  buildTaxVersions,
  TAX_CATEGORY_META,
  type TaxType,
  type TaxCategory,
} from "@/lib/mock/tax-master";

const pct = (f: number) => `${(f * 100).toFixed((f * 100) % 1 === 0 ? 0 : 1)}%`;
const CATEGORIES: TaxCategory[] = ["PPN", "PB1", "PPh", "PPD", "Lainnya"];

type TaxForm = { code: string; label: string; category: TaxCategory; rate: string; description: string };
const EMPTY_FORM: TaxForm = { code: "", label: "", category: "PPN", rate: "", description: "" };

/**
 * Master Tax Engine — catalogue of tax types (PPN, PB1, PPh, PPD, …) with rates
 * and versions. Leaders/super admins can add new tax types and edit rates
 * (session-local). Version history and per-project config are later tasks.
 * Persona-scoped.
 */
export function MasterTaxClient() {
  const { persona } = usePersona();
  const editable = persona.capabilities.canConfigure;

  const [customTaxes, setCustomTaxes] = useState<TaxType[]>([]);
  const [overrides, setOverrides] = useState<Record<string, Partial<TaxType>>>({});
  const [dbTaxes, setDbTaxes] = useState<TaxType[] | null>(null);
  const [saveNote, setSaveNote] = useState<string | null>(null);

  const loadTaxes = useCallback(async () => {
    try {
      const res = await fetch("/api/master-tax", { cache: "no-store", headers: personaHeaders(persona.id) });
      const data = (await res.json()) as {
        source?: string;
        taxes?: Array<{ projectCode?: string | null; code: string; label: string; rate: number | string; active?: boolean }>;
      };
      if (data.source !== "db" || !Array.isArray(data.taxes)) {
        setDbTaxes(null);
        return;
      }
      const catByCode = new Map(listTaxTypes().map((t) => [t.code, t.category] as const));
      const byCode = new Map<string, TaxType>();
      for (const r of data.taxes) {
        if (r.projectCode) continue; // master catalog = global rows only
        if (byCode.has(r.code)) continue;
        byCode.set(r.code, {
          code: r.code,
          label: r.label,
          category: catByCode.get(r.code) ?? "PPN",
          rate: Number(r.rate) || 0,
          description: "",
          version: 1,
          active: r.active !== false,
        });
      }
      setDbTaxes(byCode.size > 0 ? Array.from(byCode.values()) : null);
    } catch {
      setDbTaxes(null);
    }
  }, [persona.id]);

  useEffect(() => {
    void loadTaxes();
  }, [loadTaxes]);

  const taxes = useMemo(
    () =>
      [...(dbTaxes ?? listTaxTypes()), ...customTaxes].map((t) =>
        overrides[t.code] ? { ...t, ...overrides[t.code] } : t,
      ),
    [customTaxes, overrides, dbTaxes],
  );
  const isEdited = (code: string) => code in overrides;
  const activeCount = taxes.filter((t) => t.active).length;

  const [formOpen, setFormOpen] = useState(false);
  const [editCode, setEditCode] = useState<string | null>(null);
  const [form, setForm] = useState<TaxForm>(EMPTY_FORM);
  const setField = <K extends keyof TaxForm>(k: K, v: TaxForm[K]) => setForm((prev) => ({ ...prev, [k]: v }));

  function openAdd() {
    setEditCode(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  }

  function openEdit(t: TaxType) {
    setEditCode(t.code);
    setForm({
      code: t.code,
      label: t.label,
      category: t.category,
      rate: String(Math.round(t.rate * 1000) / 10),
      description: t.description,
    });
    setFormOpen(true);
  }

  // Version-history modal.
  const [historyTax, setHistoryTax] = useState<TaxType | null>(null);
  const versions = useMemo(() => (historyTax ? buildTaxVersions(historyTax) : []), [historyTax]);

  const formValid = form.label.trim().length > 0 && (editCode !== null || form.code.trim().length > 0);

  async function saveForm() {
    if (!formValid) return;
    const rate = Math.max(0, (Number(form.rate) || 0) / 100);
    const code = editCode ?? (form.code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "") || `TAX${Date.now()}`);
    const label = form.label.trim();
    if (editCode) {
      setOverrides((prev) => ({
        ...prev,
        [editCode]: { label, category: form.category, rate, description: form.description.trim() },
      }));
    } else {
      setCustomTaxes((prev) => [
        ...prev,
        { code, label, category: form.category, rate, description: form.description.trim(), version: 1, active: true },
      ]);
    }
    setFormOpen(false);

    // Persist (upsert by code, global default) to the database.
    try {
      const res = await fetch("/api/master-tax", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...personaHeaders(persona.id) },
        body: JSON.stringify({ code, label, rate }),
      });
      const data = (await res.json().catch(() => ({}))) as { source?: string; error?: string };
      if (res.ok && data.source === "db") {
        setSaveNote("Tersimpan ke database ✓");
        setCustomTaxes([]);
        setOverrides({});
        await loadTaxes();
      } else if (res.ok) {
        setSaveNote("Tersimpan di sesi ini (database tidak tersedia).");
      } else {
        setSaveNote(data.error ?? "Gagal menyimpan.");
      }
    } catch {
      setSaveNote("Tersimpan di sesi ini (jaringan bermasalah).");
    }
  }

  return (
    <div>
      <PageHeader
        title="Master Tax Engine"
        description="Katalog jenis pajak (config-driven) yang dapat diaktifkan per project."
        breadcrumbs={[{ label: "Master Data" }, { label: "Master Tax" }]}
      />

      <div className="space-y-6 p-4 md:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <PersonaBanner persona={persona} scopeSummary={`${taxes.length} jenis pajak`} />
          {saveNote && <span className="text-xs text-emerald-700">{saveNote}</span>}
          <div className="ml-auto flex items-center gap-2">
            <Badge variant="default">{taxes.length} jenis</Badge>
            <Badge variant="success">{activeCount} aktif</Badge>
            {editable && (
              <Button size="sm" onClick={openAdd} className="gap-1.5">
                <Plus className="h-4 w-4" />
                Tambah Pajak
              </Button>
            )}
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Landmark className="h-4 w-4 text-primary" />
              Daftar Jenis Pajak
            </CardTitle>
            <CardDescription>Tarif dan kategori pajak yang tersedia di sistem.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Jenis Pajak</th>
                    <th className="px-3 py-2 font-medium">Kategori</th>
                    <th className="px-3 py-2 text-right font-medium">Tarif</th>
                    <th className="px-3 py-2 font-medium">Versi</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    {editable && <th className="px-3 py-2 text-right font-medium">Aksi</th>}
                  </tr>
                </thead>
                <tbody>
                  {taxes.map((t) => {
                    const cat = TAX_CATEGORY_META[t.category];
                    return (
                      <tr key={t.code} className={`border-b last:border-b-0 ${t.active ? "" : "opacity-50"}`}>
                        <td className="px-3 py-2 font-medium">
                          {t.label}
                          {t.code.startsWith("TAX") && <Badge variant="success" className="ml-2">Kustom</Badge>}
                          {isEdited(t.code) && <Badge variant="warning" className="ml-2">Diubah</Badge>}
                          <div className="font-mono text-[11px] text-muted-foreground">{t.code}</div>
                          <div className="text-xs text-muted-foreground">{t.description}</div>
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant={cat.variant}>{cat.label}</Badge>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Badge variant="info" className="gap-1">
                            <Percent className="h-3 w-3" />
                            {pct(t.rate)}
                          </Badge>
                        </td>
                        <td className="px-3 py-2">
                          <button type="button" onClick={() => setHistoryTax(t)} aria-label={`Riwayat versi ${t.label}`}>
                            <Badge variant="secondary" className="gap-1 hover:bg-accent">
                              <GitCommitVertical className="h-3 w-3" />v{t.version}
                            </Badge>
                          </button>
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant={t.active ? "success" : "muted"}>{t.active ? "Aktif" : "Nonaktif"}</Badge>
                        </td>
                        {editable && (
                          <td className="px-3 py-2 text-right">
                            <Button variant="ghost" size="sm" onClick={() => openEdit(t)} className="h-7 gap-1 px-2">
                              <Pencil className="h-3.5 w-3.5" />
                              Ubah
                            </Button>
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
      </div>

      <Dialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editCode ? "Ubah Jenis Pajak" : "Tambah Jenis Pajak"}
        description="Tarif dalam persen dari dasar pengenaan pajak."
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
              <label className="text-xs font-medium text-muted-foreground">Nama Pajak</label>
              <Input value={form.label} onChange={(e) => setField("label", e.target.value)} placeholder="mis. PPN 12%" className="h-9" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Kode</label>
              <Input
                value={form.code}
                onChange={(e) => setField("code", e.target.value.toUpperCase())}
                disabled={Boolean(editCode)}
                placeholder="mis. PPN12"
                className="h-9 disabled:opacity-60"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Kategori</label>
              <select
                value={form.category}
                onChange={(e) => setField("category", e.target.value as TaxCategory)}
                className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Tarif (%)</label>
              <Input type="number" min={0} value={form.rate} onChange={(e) => setField("rate", e.target.value)} placeholder="mis. 11" className="h-9 tabular-nums" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Deskripsi</label>
            <Input value={form.description} onChange={(e) => setField("description", e.target.value)} className="h-9" />
          </div>
        </div>
      </Dialog>

      <Dialog
        open={historyTax !== null}
        onClose={() => setHistoryTax(null)}
        title={historyTax ? `Riwayat Versi — ${historyTax.label}` : "Riwayat Versi Pajak"}
        description="Perubahan tarif disimpan non-destructive (versi lama tidak ditimpa)."
        className="max-w-lg"
      >
        <ol className="space-y-3">
          {versions.map((v, i) => {
            const prev = versions[i + 1];
            return (
              <li key={v.version} className="flex items-start gap-3">
                <Badge variant={i === 0 ? "success" : "muted"} className="mt-0.5 shrink-0 gap-1">
                  <GitCommitVertical className="h-3 w-3" />v{v.version}
                </Badge>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-medium">{v.summary}</span>
                    <span className="flex items-center gap-1.5 text-xs tabular-nums">
                      {prev && (
                        <>
                          <span className="text-muted-foreground line-through">{pct(prev.rate)}</span>
                          <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        </>
                      )}
                      <span className="font-medium">{pct(v.rate)}</span>
                    </span>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {v.changedBy} · {formatDateTime(v.at)}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </Dialog>
    </div>
  );
}
