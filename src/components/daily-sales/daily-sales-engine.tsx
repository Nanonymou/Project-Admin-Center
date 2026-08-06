"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CopyPlus,
  Download,
  History,
  Info,
  MapPin,
  Pencil,
  Save,
  ShoppingCart,
  Trash2,
  Upload,
} from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { usePersona } from "@/components/providers/persona-provider";
import { useActiveSite } from "@/components/providers/active-site-provider";
import {
  getServiceCategories,
  lineTotal,
  sumSalesBreakdown,
  validateSalesEntry,
  type SalesEntryInput,
} from "@/lib/mock/service-config";
import { DynamicSalesTable } from "@/components/daily-sales/dynamic-sales-table";
import { SalesEntryTable } from "@/components/daily-sales/sales-entry-table";
import { ChangeHistory } from "@/components/daily-sales/change-history";
import { buildAuditTrail } from "@/lib/mock/audit-trail";
import { getPriceListFor } from "@/lib/mock/pricing-config";
import { getAreasFor } from "@/lib/mock/area-config";
import { buildSalesHistory } from "@/lib/mock/sales-history";
import { SITE_KPI } from "@/lib/mock/site-kpi";
import { MOCK_WORKSPACES } from "@/lib/mock/workspaces";
import { canAccessLocation } from "@/lib/personas";
import { computeTax } from "@/lib/finance";
import { toCsv, parseCsv, downloadTextFile } from "@/lib/csv";
import { cn, formatCurrency } from "@/lib/utils";

type SubmittedEntry = {
  id: string;
  date: string;
  area: string;
  areaId: string;
  total: number;
  tax: number;
  lines: { label: string; qty: number; price: number; total: number }[];
  status: "draft" | "submitted";
  // Snapshot of the raw form input so the entry can be re-loaded for editing.
  input: SalesEntryInput;
  activeKeys: string[];
};

export function DailySalesEngine() {
  const { persona } = usePersona();
  const { activeWorkspace } = useActiveSite();

  // Location selector — input can target any location the persona can access,
  // not only the globally active workspace. The selected site's project config
  // (categories, pricing, tax) drives the whole form generically.
  const accessibleWorkspaces = useMemo(
    () => MOCK_WORKSPACES.filter((w) => canAccessLocation(persona, w.locationId, w.projectCode)),
    [persona],
  );
  const [selectedLocationId, setSelectedLocationId] = useState(activeWorkspace.locationId);
  useEffect(() => {
    setSelectedLocationId(activeWorkspace.locationId);
  }, [activeWorkspace.locationId]);
  const workspace = useMemo(
    () => accessibleWorkspaces.find((w) => w.locationId === selectedLocationId) ?? activeWorkspace,
    [accessibleWorkspaces, selectedLocationId, activeWorkspace],
  );

  const categories = useMemo(
    () => getServiceCategories(workspace.projectCode),
    [workspace.projectCode],
  );

  const today = new Date().toISOString().slice(0, 10);
  const yesterday = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  }, []);

  const priceList = useMemo(
    () => getPriceListFor(workspace.projectCode, workspace.locationId),
    [workspace.projectCode, workspace.locationId],
  );

  const areas = useMemo(
    () => getAreasFor(workspace.locationId, workspace.locationName),
    [workspace.locationId, workspace.locationName],
  );

  const [area, setArea] = useState("");
  const [date, setDate] = useState(today);
  const [values, setValues] = useState<SalesEntryInput>(() =>
    Object.fromEntries(categories.map((c) => [c.key, { qty: 0, price: priceList[c.key] ?? c.defaultPrice }])),
  );
  const [activeKeys, setActiveKeys] = useState<string[]>(() => categories.map((c) => c.key));
  const [touched, setTouched] = useState(false);
  const [entries, setEntries] = useState<SubmittedEntry[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  // When the target location/project changes, reset the form to that project's
  // categories & default prices so stale keys never leak across projects.
  useEffect(() => {
    setArea("");
    setValues(Object.fromEntries(categories.map((c) => [c.key, { qty: 0, price: priceList[c.key] ?? c.defaultPrice }])));
    setActiveKeys(categories.map((c) => c.key));
    setTouched(false);
    setEditingId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace.locationId, workspace.projectCode]);

  const activeCategories = useMemo(
    () => categories.filter((c) => activeKeys.includes(c.key)),
    [categories, activeKeys],
  );

  const salesHistory = useMemo(() => {
    const accessible = SITE_KPI.filter((s) => canAccessLocation(persona, s.locationId, s.projectCode));
    return buildSalesHistory(accessible);
  }, [persona]);

  const auditTrail = useMemo(() => {
    const accessible = SITE_KPI.filter((s) => canAccessLocation(persona, s.locationId, s.projectCode));
    return buildAuditTrail(accessible);
  }, [persona]);

  function toggleCategory(key: string) {
    setActiveKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
    setValues((prev) =>
      prev[key]
        ? prev
        : { ...prev, [key]: { qty: 0, price: priceList[key] ?? categories.find((c) => c.key === key)?.defaultPrice ?? 0 } },
    );
  }

  const canCreate =
    persona.role === "site_admin" || persona.role === "super_admin" || persona.role === "leader_admin";
  const dateAllowed = date === today || date === yesterday;

  const errors = useMemo(() => validateSalesEntry(activeCategories, values), [activeCategories, values]);
  const breakdown = useMemo(() => sumSalesBreakdown(activeCategories, values), [activeCategories, values]);
  // Net daily total (gross sales minus backcharge) is the taxable base.
  const subtotal = breakdown.net;
  const tax = useMemo(
    () => computeTax(subtotal, workspace.projectCode),
    [subtotal, workspace.projectCode],
  );
  const formError = errors.find((e) => e.key === "_form");

  function setLine(key: string, field: "qty" | "price", raw: string) {
    const num = raw === "" ? 0 : Number(raw);
    setValues((prev) => ({ ...prev, [key]: { ...prev[key], [field]: num } }));
  }

  function resetForm() {
    setValues(Object.fromEntries(categories.map((c) => [c.key, { qty: 0, price: priceList[c.key] ?? c.defaultPrice }])));
    setActiveKeys(categories.map((c) => c.key));
    setArea("");
    setDate(today);
    setTouched(false);
    setEditingId(null);
  }

  function handleSubmit(status: "draft" | "submitted") {
    setTouched(true);
    if (!dateAllowed || !area || errors.length > 0) return;
    const entry: SubmittedEntry = {
      id: editingId ?? `${date}-${Date.now()}`,
      date,
      area: areas.find((a) => a.id === area)?.name ?? area,
      areaId: area,
      total: subtotal,
      tax,
      status,
      input: JSON.parse(JSON.stringify(values)),
      activeKeys: [...activeKeys],
      lines: activeCategories
        .filter((c) => (values[c.key]?.qty || 0) > 0)
        .map((c) => ({
          label: c.label,
          qty: values[c.key].qty,
          price: values[c.key].price,
          total: lineTotal(values[c.key]),
        })),
    };
    setEntries((prev) =>
      editingId ? prev.map((e) => (e.id === editingId ? entry : e)) : [entry, ...prev],
    );
    resetForm();
  }

  function editEntry(entry: SubmittedEntry) {
    setDate(entry.date);
    setArea(entry.areaId);
    setValues(JSON.parse(JSON.stringify(entry.input)));
    setActiveKeys(entry.activeKeys);
    setEditingId(entry.id);
    setTouched(false);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function deleteEntry(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id));
    if (editingId === id) resetForm();
  }

  // Prefill the form from yesterday's entry (or the latest one) as a fresh entry.
  const copySource = useMemo(
    () => entries.find((e) => e.date === yesterday) ?? entries[0],
    [entries, yesterday],
  );

  function copyYesterday() {
    if (!copySource) return;
    setValues(JSON.parse(JSON.stringify(copySource.input)));
    setActiveKeys(copySource.activeKeys);
    setArea(copySource.areaId);
    setDate(today);
    setEditingId(null);
    setTouched(false);
  }

  function duplicateEntry(entry: SubmittedEntry) {
    const copy: SubmittedEntry = {
      ...entry,
      id: `${entry.date}-${Date.now()}`,
      status: "draft",
      input: JSON.parse(JSON.stringify(entry.input)),
      activeKeys: [...entry.activeKeys],
      lines: entry.lines.map((l) => ({ ...l })),
    };
    setEntries((prev) => [copy, ...prev]);
  }

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [ioMessage, setIoMessage] = useState<string | null>(null);

  // Export all session entries as a flat CSV (one row per line item).
  function exportExcel() {
    const header = ["Tanggal", "Area", "Kategori", "Qty", "Harga", "Subtotal", "Status"];
    const rows: (string | number)[][] = [header];
    for (const e of entries) {
      for (const l of e.lines) {
        rows.push([e.date, e.area, l.label, l.qty, l.price, l.total, e.status]);
      }
    }
    downloadTextFile(`daily-sales-${workspace.projectCode}-${workspace.locationName}.csv`, toCsv(rows));
    setIoMessage(`${entries.length} entri diekspor.`);
  }

  // Import a CSV using the same columns; rows are grouped into entries by
  // date + area, matched to the current project's categories by label.
  async function importExcel(file: File) {
    const text = await file.text();
    const rows = parseCsv(text);
    if (rows.length < 2) {
      setIoMessage("File kosong atau format tidak dikenali.");
      return;
    }
    const labelToCat = new Map(categories.map((c) => [c.label.toLowerCase(), c]));
    const groups = new Map<string, { date: string; area: string; input: SalesEntryInput; keys: string[] }>();
    for (let i = 1; i < rows.length; i++) {
      const [date, area, kategori, qtyRaw, priceRaw] = rows[i];
      const cat = labelToCat.get((kategori ?? "").trim().toLowerCase());
      if (!cat) continue;
      const key = `${date}||${area}`;
      const group = groups.get(key) ?? { date, area, input: {}, keys: [] };
      group.input[cat.key] = { qty: Number(qtyRaw) || 0, price: Number(priceRaw) || 0 };
      if (!group.keys.includes(cat.key)) group.keys.push(cat.key);
      groups.set(key, group);
    }
    const imported: SubmittedEntry[] = [];
    for (const group of groups.values()) {
      const groupCats = categories.filter((c) => group.keys.includes(c.key));
      const bd = sumSalesBreakdown(groupCats, group.input);
      const matchedArea = areas.find((a) => a.name === group.area);
      imported.push({
        id: `${group.date}-imp-${Date.now()}-${imported.length}`,
        date: group.date,
        area: group.area,
        areaId: matchedArea?.id ?? "",
        total: bd.net,
        tax: computeTax(bd.net, workspace.projectCode),
        status: "draft",
        input: group.input,
        activeKeys: group.keys,
        lines: groupCats
          .filter((c) => (group.input[c.key]?.qty || 0) > 0)
          .map((c) => ({
            label: c.label,
            qty: group.input[c.key].qty,
            price: group.input[c.key].price,
            total: lineTotal(group.input[c.key]),
          })),
      });
    }
    if (imported.length === 0) {
      setIoMessage("Tidak ada baris yang cocok dengan kategori project ini.");
      return;
    }
    setEntries((prev) => [...imported, ...prev]);
    setIoMessage(`${imported.length} entri diimpor dari ${file.name}.`);
  }

  function onImportChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void importExcel(file);
    e.target.value = "";
  }

  return (
    <div>
      <PageHeader
        title="Submit Daily Sales"
        description={`Input penjualan harian untuk ${workspace.projectName} · ${workspace.locationName}.`}
        breadcrumbs={[{ label: "Operasional" }, { label: "Daily Sales" }]}
        actions={
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={onImportChange}
            />
            <Button
              variant="outline"
              size="sm"
              disabled={!canCreate}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4" />
              Impor Excel
            </Button>
            <Button variant="outline" size="sm" disabled={entries.length === 0} onClick={exportExcel}>
              <Download className="h-4 w-4" />
              Ekspor Excel
            </Button>
          </>
        }
      />

      <div className="space-y-6 p-4 md:p-6">
        <PersonaBanner
          persona={persona}
          scopeSummary={`${workspace.projectCode} · ${workspace.locationName}`}
        />

        {ioMessage && (
          <div className="flex items-center justify-between gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">
            <span>{ioMessage}</span>
            <button type="button" onClick={() => setIoMessage(null)} className="text-sky-700 hover:underline">
              Tutup
            </button>
          </div>
        )}

        {accessibleWorkspaces.length > 1 && (
          <div className="flex flex-wrap items-center gap-3 rounded-md border bg-card px-3 py-2">
            <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              Lokasi Input
            </span>
            <select
              value={selectedLocationId}
              onChange={(e) => setSelectedLocationId(e.target.value)}
              className="h-9 min-w-[220px] rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              {accessibleWorkspaces.map((w) => (
                <option key={w.locationId} value={w.locationId}>
                  {w.projectCode} · {w.locationName}
                </option>
              ))}
            </select>
            <span className="text-[11px] text-muted-foreground">
              Kategori & pajak menyesuaikan konfigurasi project lokasi terpilih.
            </span>
          </div>
        )}

        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Kategori & harga default mengikuti konfigurasi project{" "}
            <b>{workspace.projectCode}</b>. Aturan Cut-Off <b>H+1</b> — input hanya untuk hari
            ini atau kemarin. Sales = Qty × Harga.
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-primary" />
                Form Daily Sales
              </CardTitle>
              <CardDescription>Isi Qty & Harga per kategori layanan.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Tanggal</label>
                  <Input type="date" value={date} max={today} min={yesterday} onChange={(e) => setDate(e.target.value)} />
                  {touched && !dateAllowed && (
                    <p className="mt-1 text-[11px] text-rose-600">Tanggal di luar aturan H+1.</p>
                  )}
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Area <span className="text-rose-600">*</span>
                  </label>
                  <select
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                    className={cn(
                      "h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring",
                      touched && !area && "border-rose-400 focus:ring-rose-400",
                    )}
                  >
                    <option value="">— Pilih area —</option>
                    {areas.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                  {touched && !area && (
                    <p className="mt-1 text-[11px] text-rose-600">Area wajib dipilih.</p>
                  )}
                </div>
              </div>

              <p className="text-[11px] text-muted-foreground">
                Harga terisi otomatis dari Master Pricing lokasi{" "}
                <b>{workspace.locationName}</b> — dapat diubah manual bila perlu.
              </p>

              <DynamicSalesTable
                categories={categories}
                activeKeys={activeKeys}
                values={values}
                errors={errors}
                touched={touched}
                onToggleCategory={toggleCategory}
                onChangeLine={setLine}
              />

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <TotalTile label="Gross Sales" value={formatCurrency(breakdown.gross)} />
                <TotalTile
                  label="Backcharge"
                  value={`${breakdown.backcharge > 0 ? "−" : ""}${formatCurrency(breakdown.backcharge)}`}
                />
                <TotalTile label="Total Harian (net)" value={formatCurrency(subtotal)} />
                <TotalTile label="Net Invoice" value={formatCurrency(subtotal + tax)} highlight />
              </div>

              {touched && formError && (
                <div className="flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {formError.message}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3 text-sm">
                <div className="space-y-0.5">
                  <div>
                    <span className="text-muted-foreground">Total Harian (net): </span>
                    <span className="font-semibold tabular-nums">{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Gross {formatCurrency(breakdown.gross)} − Backcharge {formatCurrency(breakdown.backcharge)} · Pajak
                    ({workspace.projectCode}) {formatCurrency(tax)} · Net Invoice {formatCurrency(subtotal + tax)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {editingId && (
                    <Button variant="ghost" size="sm" onClick={resetForm}>
                      Batal
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!canCreate || !copySource}
                    onClick={copyYesterday}
                    title={copySource ? "Salin entri kemarin ke form" : "Belum ada entri untuk disalin"}
                  >
                    <CopyPlus className="h-4 w-4" />
                    Salin Kemarin
                  </Button>
                  <Button variant="outline" size="sm" disabled={!canCreate} onClick={() => handleSubmit("draft")}>
                    Simpan Draft
                  </Button>
                  <Button size="sm" disabled={!canCreate} onClick={() => handleSubmit("submitted")}>
                    <Save className="h-4 w-4" />
                    {editingId ? "Update" : "Submit"}
                  </Button>
                </div>
              </div>
              {editingId && (
                <div className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-1.5 text-[11px] text-primary">
                  <Pencil className="h-3 w-3" />
                  Sedang mengedit entri — perubahan akan menimpa entri terpilih.
                </div>
              )}
              {!canCreate && (
                <p className="text-[11px] text-muted-foreground">
                  Peran {persona.roleLabel} tidak memiliki izin input Daily Sales.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Entri Terbaru</CardTitle>
              <CardDescription>
                Tersimpan di sesi ini (mock){entries.length > 0 ? ` · ${entries.length} entri` : ""}.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {entries.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  Belum ada entri Daily Sales.
                </div>
              ) : (
                <ul className="space-y-2">
                  {entries.map((entry) => (
                    <li
                      key={entry.id}
                      className={cn(
                        "rounded-md border p-2.5",
                        editingId === entry.id && "border-primary ring-1 ring-primary",
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium tabular-nums">{entry.date}</span>
                        <Badge variant={entry.status === "submitted" ? "success" : "muted"}>
                          {entry.status === "submitted" ? "Submitted" : "Draft"}
                        </Badge>
                      </div>
                      <div className="mt-0.5 text-[11px] text-muted-foreground">{entry.area}</div>
                      <div className="mt-1 text-sm font-semibold tabular-nums">
                        {formatCurrency(entry.total)}
                      </div>
                      <ul className="mt-1 space-y-0.5 text-[11px] text-muted-foreground">
                        {entry.lines.map((l) => (
                          <li key={l.label} className="flex justify-between">
                            <span>{l.label} × {l.qty}</span>
                            <span className="tabular-nums">{formatCurrency(l.total)}</span>
                          </li>
                        ))}
                      </ul>
                      {canCreate && (
                        <div className="mt-2 flex items-center justify-end gap-2 border-t pt-2">
                          <button
                            type="button"
                            onClick={() => duplicateEntry(entry)}
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
                          >
                            <CopyPlus className="h-3 w-3" />
                            Duplikat
                          </button>
                          <button
                            type="button"
                            onClick={() => editEntry(entry)}
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
                          >
                            <Pencil className="h-3 w-3" />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteEntry(entry.id)}
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-rose-600"
                          >
                            <Trash2 className="h-3 w-3" />
                            Hapus
                          </button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Entri Penjualan per Site</CardTitle>
            <CardDescription>
              Riwayat Daily Sales per lokasi dalam scope Anda — klik header untuk buka/tutup.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SalesEntryTable entries={salesHistory} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-4 w-4 text-primary" />
              Riwayat Perubahan Entri
            </CardTitle>
            <CardDescription>
              Audit trail perubahan Daily Sales — siapa mengubah apa dan kapan.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChangeHistory entries={auditTrail} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function TotalTile({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-md border p-2.5",
        highlight ? "border-primary/30 bg-primary/5" : "bg-background",
      )}
    >
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 truncate text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}
