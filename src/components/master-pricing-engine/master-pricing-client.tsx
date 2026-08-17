"use client";

import { useMemo, useState } from "react";
import { Coins, Layers, Building2, Tag, Minus, Plus, Pencil, Ban, RotateCcw, History, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { LockBanner } from "@/components/master-lock/lock-banner";
import { usePersona } from "@/components/providers/persona-provider";
import { useMasterEditable } from "@/lib/hooks/use-master-editable";
import { canAccessProject } from "@/lib/personas";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { MOCK_WORKSPACES, type Workspace } from "@/lib/mock/workspaces";
import { getServiceCategories, type ServiceCategory } from "@/lib/mock/service-config";
import { getPriceFor } from "@/lib/mock/pricing-config";
import { buildPriceChanges, type PriceChangeEntry, type PriceChangeAction } from "@/lib/mock/price-change-log";
import { personaHeaders } from "@/lib/client/notif";

type ProjectOption = { projectCode: string; projectName: string; locations: Workspace[] };
type PriceCategory = ServiceCategory & { custom?: boolean };

const ACTION_META: Record<PriceChangeAction, { label: string; variant: "success" | "info" | "warning" | "danger" }> = {
  create: { label: "Dibuat", variant: "success" },
  update: { label: "Diubah", variant: "info" },
  activate: { label: "Diaktifkan", variant: "warning" },
  deactivate: { label: "Dinonaktifkan", variant: "danger" },
};

/**
 * Master Pricing Engine — the central, config-driven price master per project
 * (the source the per-site Harga Meals list derives from). For a project it
 * lists each service category with its base price and the effective price at
 * every location (base × per-location multiplier). Read-only here; add/edit
 * per-project, toggle, and change history are layered on by later tasks.
 * Persona-scoped by project access.
 */
export function MasterPricingClient() {
  const { persona } = usePersona();

  const projects: ProjectOption[] = useMemo(() => {
    const map = new Map<string, ProjectOption>();
    for (const w of MOCK_WORKSPACES) {
      if (!canAccessProject(persona, w.projectCode)) continue;
      const opt = map.get(w.projectCode) ?? {
        projectCode: w.projectCode,
        projectName: w.projectName,
        locations: [],
      };
      opt.locations.push(w);
      map.set(w.projectCode, opt);
    }
    return [...map.values()];
  }, [persona]);

  const [projIndex, setProjIndex] = useState(0);
  const project = projects[projIndex] ?? projects[0];
  const lock = useMasterEditable("pricing");
  const editable = lock.editable;

  // Session-local custom categories + per-project base-price overrides.
  const [customCats, setCustomCats] = useState<Record<string, PriceCategory[]>>({});
  const [priceOverrides, setPriceOverrides] = useState<Record<string, Record<string, number>>>({});
  const [inactive, setInactive] = useState<Record<string, string[]>>({});
  const projectCode = project?.projectCode ?? "";
  const projOverrides = priceOverrides[projectCode] ?? {};
  const projInactive = inactive[projectCode] ?? [];
  const isInactive = (key: string) => projInactive.includes(key);

  // This session's price-change entries per project.
  const [sessionLog, setSessionLog] = useState<Record<string, PriceChangeEntry[]>>({});
  function recordChange(
    categoryKey: string,
    categoryLabel: string,
    action: PriceChangeAction,
    before: number | null,
    after: number | null,
  ) {
    const entry: PriceChangeEntry = {
      id: `session-${projectCode}-${categoryKey}-${action}-${Date.now()}`,
      categoryKey,
      categoryLabel,
      action,
      before,
      after,
      editor: persona.name,
      at: new Date().toISOString(),
    };
    setSessionLog((prev) => ({ ...prev, [projectCode]: [entry, ...(prev[projectCode] ?? [])] }));
  }

  function toggleActive(key: string) {
    const willDeactivate = !isInactive(key);
    const label = categories.find((c) => c.key === key)?.label ?? key;
    setInactive((prev) => {
      const cur = prev[projectCode] ?? [];
      const next = cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key];
      return { ...prev, [projectCode]: next };
    });
    recordChange(key, label, willDeactivate ? "deactivate" : "activate", null, null);
  }

  /** Effective price of a category at a location, honoring project overrides. */
  function effectivePrice(c: PriceCategory, locationId: string): number {
    if (c.key in projOverrides) return projOverrides[c.key];
    if (c.custom) return c.defaultPrice;
    return getPriceFor(projectCode, locationId, c.key);
  }

  const categories: PriceCategory[] = useMemo(
    () => (project ? [...getServiceCategories(project.projectCode), ...(customCats[projectCode] ?? [])] : []),
    [project, customCats, projectCode],
  );

  // Change history: this session's edits first, then a seeded master baseline
  // (from the project's first location), newest first.
  const history: PriceChangeEntry[] = useMemo(() => {
    if (!project) return [];
    const baseline = buildPriceChanges(project.projectCode, project.locations[0]?.locationId ?? "");
    return [...(sessionLog[projectCode] ?? []), ...baseline];
  }, [project, sessionLog, projectCode]);

  // Add-category form.
  const [formOpen, setFormOpen] = useState(false);
  const [formLabel, setFormLabel] = useState("");
  const [formUnit, setFormUnit] = useState("");
  const [formPrice, setFormPrice] = useState("");
  const [formDeduction, setFormDeduction] = useState(false);

  function openAdd() {
    setFormLabel("");
    setFormUnit("");
    setFormPrice("");
    setFormDeduction(false);
    setFormOpen(true);
  }

  function saveForm() {
    const label = formLabel.trim();
    if (!label) return;
    const key = `custom_${label.toLowerCase().replace(/[^a-z0-9]+/g, "_")}_${Date.now()}`;
    const cat: PriceCategory = {
      key,
      label,
      unit: formUnit.trim() || "unit",
      defaultPrice: Math.max(0, Math.round(Number(formPrice) || 0)),
      deduction: formDeduction,
      custom: true,
    };
    setCustomCats((prev) => ({ ...prev, [projectCode]: [...(prev[projectCode] ?? []), cat] }));
    recordChange(cat.key, cat.label, "create", null, cat.defaultPrice);
    setFormOpen(false);
  }

  // Edit-price-per-project modal.
  const [editCat, setEditCat] = useState<PriceCategory | null>(null);
  const [editPrice, setEditPrice] = useState("");
  const [saveNote, setSaveNote] = useState<string | null>(null);

  function openEdit(c: PriceCategory) {
    setEditCat(c);
    // Prefill with the current effective base (override, or the project's first-site price).
    const current = c.key in projOverrides
      ? projOverrides[c.key]
      : c.custom
        ? c.defaultPrice
        : getPriceFor(projectCode, project?.locations[0]?.locationId ?? "", c.key);
    setEditPrice(String(current));
  }

  async function saveEdit() {
    if (!editCat) return;
    const cat = editCat;
    const price = Math.max(0, Math.round(Number(editPrice) || 0));
    const before =
      cat.key in projOverrides
        ? projOverrides[cat.key]
        : cat.custom
          ? cat.defaultPrice
          : getPriceFor(projectCode, project?.locations[0]?.locationId ?? "", cat.key);
    setPriceOverrides((prev) => ({
      ...prev,
      [projectCode]: { ...(prev[projectCode] ?? {}), [cat.key]: price },
    }));
    if (price !== before) recordChange(cat.key, cat.label, "update", before, price);
    setEditCat(null);

    // Persist the new price to every location in the project (the price applies
    // project-wide in this UI; master_prices is per-location).
    const locations = project?.locations ?? [];
    if (locations.length === 0) return;
    try {
      const oks = await Promise.all(
        locations.map((loc) =>
          fetch("/api/master-pricing", {
            method: "POST",
            headers: { "Content-Type": "application/json", ...personaHeaders(persona.id) },
            body: JSON.stringify({ projectCode, locationId: loc.locationId, categoryKey: cat.key, price }),
          })
            .then((r) => r.ok)
            .catch(() => false),
        ),
      );
      setSaveNote(oks.every(Boolean) ? "Harga tersimpan ke database ✓" : "Sebagian lokasi belum tersimpan.");
    } catch {
      setSaveNote("Tersimpan di sesi ini (database tidak tersedia).");
    }
  }

  if (!project) {
    return (
      <div>
        <PageHeader title="Master Pricing" description="Master harga per proyek." />
        <div className="p-6 text-sm text-muted-foreground">Tidak ada proyek dalam cakupan Anda.</div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Master Pricing Engine"
        description="Kontrol pusat harga per proyek (config-driven)."
        breadcrumbs={[{ label: "Master Data" }, { label: "Master Pricing" }]}
      />

      <div className="space-y-6 p-4 md:p-6">
        <PersonaBanner persona={persona} scopeSummary={`${projects.length} proyek`} />
        {saveNote && (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {saveNote}
          </div>
        )}
        <LockBanner reason={lock.reason} />

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
          <Badge variant="default" className="ml-auto gap-1">
            <Layers className="h-3 w-3" />
            {categories.length - projInactive.length} aktif / {categories.length} kategori
          </Badge>
          <Badge variant="info" className="gap-1">
            <Building2 className="h-3 w-3" />
            {project.locations.length} site
          </Badge>
          {editable && (
            <Button size="sm" onClick={openAdd} className="gap-1.5">
              <Plus className="h-4 w-4" />
              Tambah Kategori
            </Button>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Coins className="h-4 w-4 text-primary" />
              Harga Efektif — {project.projectName}
            </CardTitle>
            <CardDescription>
              Harga dasar per kategori dan harga efektif tiap site (dasar × pengali lokasi).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Kategori</th>
                    <th className="px-3 py-2 font-medium">Satuan</th>
                    <th className="px-3 py-2 text-right font-medium">Harga Dasar</th>
                    {project.locations.map((loc) => (
                      <th key={loc.locationId} className="px-3 py-2 text-right font-medium">
                        {loc.locationName}
                      </th>
                    ))}
                    {editable && <th className="px-3 py-2 text-right font-medium">Aksi</th>}
                  </tr>
                </thead>
                <tbody>
                  {categories.map((c) => {
                    const off = isInactive(c.key);
                    return (
                    <tr key={c.key} className={`border-b last:border-b-0 ${off ? "opacity-50" : ""}`}>
                      <td className="px-3 py-2 font-medium">
                        <span className={off ? "line-through" : ""}>{c.label}</span>
                        {c.custom && <Badge variant="success" className="ml-2">Kustom</Badge>}
                        {c.key in projOverrides && <Badge variant="warning" className="ml-2">Diubah</Badge>}
                        {off && <Badge variant="danger" className="ml-2">Nonaktif</Badge>}
                        {c.deduction && (
                          <Badge variant="danger" className="ml-2 gap-1">
                            <Minus className="h-3 w-3" />
                            Potongan
                          </Badge>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant="info" className="gap-1">
                          <Tag className="h-3 w-3" />
                          {c.unit}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {formatCurrency(c.defaultPrice)}
                      </td>
                      {project.locations.map((loc) => (
                        <td key={loc.locationId} className="px-3 py-2 text-right font-semibold tabular-nums">
                          {formatCurrency(effectivePrice(c, loc.locationId))}
                        </td>
                      ))}
                      {editable && (
                        <td className="px-3 py-2 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEdit(c)}
                              disabled={off}
                              className="h-7 gap-1 px-2"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Ubah
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleActive(c.key)}
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
              <History className="h-4 w-4 text-primary" />
              Riwayat Perubahan Harga
            </CardTitle>
            <CardDescription>
              Jejak perubahan harga master untuk {project.projectName} (termasuk perubahan sesi ini).
            </CardDescription>
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <div className="rounded-md border border-dashed py-6 text-center text-sm text-muted-foreground">
                Belum ada riwayat perubahan.
              </div>
            ) : (
              <ol className="space-y-3">
                {history.slice(0, 20).map((e) => (
                  <li key={e.id} className="flex items-start gap-3">
                    <Badge variant={ACTION_META[e.action].variant} className="mt-0.5 shrink-0">
                      {ACTION_META[e.action].label}
                    </Badge>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="font-medium">{e.categoryLabel}</span>
                        {e.action === "update" && (
                          <span className="flex items-center gap-1.5 text-xs tabular-nums">
                            <span className="text-muted-foreground line-through">
                              {e.before !== null ? formatCurrency(e.before) : "—"}
                            </span>
                            <ArrowRight className="h-3 w-3 text-muted-foreground" />
                            <span className="font-medium">
                              {e.after !== null ? formatCurrency(e.after) : "—"}
                            </span>
                          </span>
                        )}
                        {e.action === "create" && e.after !== null && (
                          <span className="text-xs font-medium tabular-nums">{formatCurrency(e.after)}</span>
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {e.editor} · {formatDateTime(e.at)}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title="Tambah Kategori Harga"
        description={`Kategori baru untuk proyek ${project.projectName}.`}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setFormOpen(false)}>
              Batal
            </Button>
            <Button size="sm" onClick={saveForm} disabled={!formLabel.trim()}>
              Simpan
            </Button>
          </div>
        }
      >
        <div className="space-y-3 text-sm">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Nama Kategori</label>
            <Input value={formLabel} onChange={(e) => setFormLabel(e.target.value)} placeholder="mis. Coffee Break" className="h-9" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Satuan</label>
              <Input value={formUnit} onChange={(e) => setFormUnit(e.target.value)} placeholder="mis. porsi" className="h-9" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Harga Dasar (Rp)</label>
              <Input
                type="number"
                min={0}
                value={formPrice}
                onChange={(e) => setFormPrice(e.target.value)}
                placeholder="0"
                className="h-9 tabular-nums"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 pt-1 text-xs font-medium text-muted-foreground">
            <input
              type="checkbox"
              checked={formDeduction}
              onChange={(e) => setFormDeduction(e.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            Kategori potongan (mengurangi total)
          </label>
          {Number(formPrice) > 0 && (
            <div className="text-xs text-muted-foreground">
              {formDeduction ? "−" : ""}
              {formatCurrency(Number(formPrice))}
            </div>
          )}
        </div>
      </Dialog>

      <Dialog
        open={editCat !== null}
        onClose={() => setEditCat(null)}
        title={editCat ? `Ubah Harga — ${editCat.label}` : "Ubah Harga"}
        description={`Harga berlaku untuk seluruh site proyek ${project.projectName}.`}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditCat(null)}>
              Batal
            </Button>
            <Button size="sm" onClick={saveEdit}>
              Simpan
            </Button>
          </div>
        }
      >
        <div className="space-y-2 text-sm">
          <label className="text-xs font-medium text-muted-foreground">Harga per Proyek (Rp)</label>
          <Input
            type="number"
            min={0}
            value={editPrice}
            onChange={(e) => setEditPrice(e.target.value)}
            className="h-9 tabular-nums"
          />
          {Number(editPrice) > 0 && (
            <div className="text-xs text-muted-foreground">
              {editCat?.deduction ? "−" : ""}
              {formatCurrency(Number(editPrice))} · berlaku di {project.locations.length} site
            </div>
          )}
        </div>
      </Dialog>
    </div>
  );
}
