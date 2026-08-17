"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, FileText, History, Info, Lock, MapPin, Paperclip, Pencil, Save, Trash2, Wallet } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { usePersona } from "@/components/providers/persona-provider";
import { useActiveSite } from "@/components/providers/active-site-provider";
import { SubmitStatusList } from "@/components/daily-cost/submit-status-list";
import { MissingSubmissionStrip } from "@/components/daily-cost/missing-submission-strip";
import { BuktiPanel } from "@/components/upload-bukti/bukti-panel";
import { buildSubmitStatus } from "@/lib/mock/closing-status";
import { SITE_KPI } from "@/lib/mock/site-kpi";
import { MOCK_WORKSPACES } from "@/lib/mock/workspaces";
import { buildPeriodLocks } from "@/lib/mock/lock-period";
import { personaHeaders } from "@/lib/client/notif";
import { canAccessLocation } from "@/lib/personas";
import {
  getCostCategories,
  sumCostEntry,
  validateCostEntry,
  type CostEntryInput,
} from "@/lib/mock/cost-config";
import { cn, formatCurrency } from "@/lib/utils";

type ProofFile = { name: string; url: string; isImage: boolean };

type SubmittedEntry = {
  id: string;
  date: string;
  total: number;
  locationId: string;
  locationName: string;
  breakdown: { label: string; amount: number; proof?: string }[];
  status: "draft" | "submitted";
};

export function DailyCostClient() {
  const { persona } = usePersona();
  const { activeWorkspace } = useActiveSite();

  // Location selector — input can target any location the persona can access.
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
    () => getCostCategories(workspace.projectCode),
    [workspace.projectCode],
  );

  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [values, setValues] = useState<CostEntryInput>({});
  const [proofs, setProofs] = useState<Record<string, ProofFile>>({});
  const [previewProof, setPreviewProof] = useState<ProofFile | null>(null);
  const [touched, setTouched] = useState(false);
  const [entries, setEntries] = useState<SubmittedEntry[]>([]);
  const [saveNote, setSaveNote] = useState<string | null>(null);

  // Load persisted cost entries for the current project from the database.
  const loadEntries = useCallback(async () => {
    try {
      const params = new URLSearchParams({ projectId: workspace.projectCode, scope: "tenant", limit: "200" });
      const res = await fetch(`/api/daily-cost?${params.toString()}`, {
        cache: "no-store",
        headers: personaHeaders(persona.id),
      });
      const data = (await res.json()) as {
        entries?: Array<{ id: string; trxDate?: string; date?: string; total?: number; status?: string; locationId?: string }>;
      };
      if (!Array.isArray(data.entries)) return;
      setEntries(
        data.entries.map((r) => {
          const locId = r.locationId ?? "";
          const ws = accessibleWorkspaces.find((w) => w.locationId === locId);
          return {
            id: String(r.id),
            date: r.trxDate ?? r.date ?? "",
            total: Number(r.total ?? 0),
            locationId: locId,
            locationName: ws?.locationName ?? locId,
            breakdown: [],
            status: (r.status === "draft" ? "draft" : "submitted") as "draft" | "submitted",
          };
        }),
      );
    } catch {
      /* keep current entries on failure */
    }
  }, [workspace.projectCode, persona.id, accessibleWorkspaces]);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [entryScope, setEntryScope] = useState<"current" | "all">("current");

  // Entries filtered by the active workspace location (or all locations).
  const visibleEntries = useMemo(
    () => (entryScope === "all" ? entries : entries.filter((e) => e.locationId === workspace.locationId)),
    [entries, entryScope, workspace.locationId],
  );

  // Reset the form when the target location/project changes.
  useEffect(() => {
    setValues({});
    setProofs({});
    setDate(today);
    setTouched(false);
    setEditingId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace.locationId, workspace.projectCode]);

  const canCreate = persona.role === "site_admin" || persona.role === "super_admin" || persona.role === "leader_admin";

  // H+1 cut-off: entries can only be for today or yesterday.
  const yesterday = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  }, []);
  const dateAllowed = date === today || date === yesterday;

  // Read-only when the entry date's period is locked for this location.
  const lockRows = useMemo(
    () => buildPeriodLocks(SITE_KPI.filter((s) => s.locationId === workspace.locationId)),
    [workspace.locationId],
  );
  const isPeriodLocked = useMemo(
    () => lockRows.some((r) => r.periodKey === date.slice(0, 7) && r.state === "locked"),
    [lockRows, date],
  );
  // Input window is H+1: any date older than yesterday is past its input period.
  const inputWindowPassed = date < yesterday;
  const readOnly = !canCreate || isPeriodLocked || inputWindowPassed;

  const submitStatus = useMemo(() => {
    const accessible = SITE_KPI.filter((s) => canAccessLocation(persona, s.locationId, s.projectCode));
    return buildSubmitStatus(accessible);
  }, [persona]);

  // Seeded submission history for the active site (past ~14 days) merged
  // with entries created this session, so the indicator has realistic data.
  const submittedIsos = useMemo(() => {
    const set = new Set<string>();
    let seed = 0;
    for (const ch of workspace.locationId) seed += ch.charCodeAt(0);
    for (let i = 1; i <= 14; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      // deterministic ~75% submitted
      if (Math.abs(Math.sin(seed + i)) > 0.28) set.add(d.toISOString().slice(0, 10));
    }
    for (const e of entries) if (e.status === "submitted") set.add(e.date);
    return Array.from(set);
  }, [workspace.locationId, entries]);

  const errors = useMemo(() => validateCostEntry(categories, values), [categories, values]);
  const total = useMemo(() => sumCostEntry(categories, values), [categories, values]);
  const formError = errors.find((e) => e.key === "_form");

  // Config-driven: a proof-required category with a positive amount must have
  // an attachment before it can be submitted.
  const missingProofKeys = useMemo(
    () =>
      categories
        .filter((c) => c.requiresProof && (values[c.key] || 0) > 0 && !proofs[c.key])
        .map((c) => c.key),
    [categories, values, proofs],
  );

  // Automatic totals across the visible (location-filtered) session entries.
  const sessionTotals = useMemo(() => {
    let all = 0;
    let submitted = 0;
    for (const e of visibleEntries) {
      all += e.total;
      if (e.status === "submitted") submitted += e.total;
    }
    return { all, submitted, count: visibleEntries.length };
  }, [visibleEntries]);

  async function deleteEntry(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id));
    try {
      await fetch(`/api/daily-cost/${id}`, { method: "DELETE", headers: personaHeaders(persona.id) });
      setSaveNote("Entri dihapus dari database.");
      await loadEntries();
    } catch {
      /* keep optimistic removal */
    }
  }

  // Aggregate cost per category across all session entries.
  const categoryTotals = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of visibleEntries) for (const b of e.breakdown) map.set(b.label, (map.get(b.label) || 0) + b.amount);
    const arr = Array.from(map.entries())
      .map(([label, amount]) => ({ label, amount }))
      .sort((a, b) => b.amount - a.amount);
    const grand = arr.reduce((s, x) => s + x.amount, 0);
    return { arr, grand };
  }, [entries]);

  function setValue(key: string, raw: string) {
    const num = raw === "" ? NaN : Number(raw);
    setValues((prev) => ({ ...prev, [key]: num }));
  }

  function setProof(key: string, file: File) {
    const isImage = file.type.startsWith("image/");
    const url = isImage ? URL.createObjectURL(file) : "";
    setProofs((prev) => ({ ...prev, [key]: { name: file.name, url, isImage } }));
  }

  async function handleSubmit(status: "draft" | "submitted") {
    setTouched(true);
    if (!dateAllowed || errors.length > 0 || isPeriodLocked) return;
    // Drafts may miss proofs; a final submit cannot.
    if (status === "submitted" && missingProofKeys.length > 0) return;
    const editId = editingId;
    const payloadValues = categories.reduce<Record<string, number>>((acc, c) => {
      if ((values[c.key] || 0) > 0) acc[c.key] = values[c.key];
      return acc;
    }, {});
    const entry: SubmittedEntry = {
      id: editId ?? `${date}-${Date.now()}`,
      date,
      total,
      locationId: workspace.locationId,
      locationName: workspace.locationName,
      status,
      breakdown: categories
        .filter((c) => (values[c.key] || 0) > 0)
        .map((c) => ({ label: c.label, amount: values[c.key], proof: proofs[c.key]?.name })),
    };
    setEntries((prev) => (editId ? prev.map((e) => (e.id === editId ? entry : e)) : [entry, ...prev]));
    setValues({});
    setProofs({});
    setDate(today);
    setTouched(false);
    setEditingId(null);

    // Persist to the database (create via submit, edit via [id] PATCH).
    const payload = {
      projectId: workspace.projectCode,
      locationId: workspace.locationId,
      trxDate: entry.date,
      values: payloadValues,
    };
    try {
      const res = await fetch(editId ? `/api/daily-cost/${editId}` : "/api/daily-cost/submit", {
        method: editId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json", ...personaHeaders(persona.id) },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as { source?: string; error?: string };
      if (res.ok && data.source === "db") {
        setSaveNote("Tersimpan ke database ✓");
        await loadEntries();
      } else if (res.ok) {
        setSaveNote("Tersimpan di sesi ini (database tidak tersedia).");
      } else {
        setSaveNote(data.error ?? "Gagal menyimpan ke database.");
      }
    } catch {
      setSaveNote("Tersimpan di sesi ini (jaringan bermasalah).");
    }
  }

  function editEntry(entry: SubmittedEntry) {
    const labelToKey = new Map(categories.map((c) => [c.label, c.key]));
    const nextValues: CostEntryInput = {};
    const nextProofs: Record<string, ProofFile> = {};
    for (const b of entry.breakdown) {
      const key = labelToKey.get(b.label);
      if (!key) continue;
      nextValues[key] = b.amount;
      if (b.proof) nextProofs[key] = { name: b.proof, url: "", isImage: false };
    }
    setValues(nextValues);
    setProofs(nextProofs);
    setDate(entry.date);
    setEditingId(entry.id);
    setTouched(false);
  }

  function cancelEdit() {
    setValues({});
    setProofs({});
    setDate(today);
    setTouched(false);
    setEditingId(null);
  }

  return (
    <div>
      <PageHeader
        title="Submit Daily Cost"
        description={`Input pengeluaran harian untuk ${workspace.projectName} · ${workspace.locationName}.`}
        breadcrumbs={[{ label: "Operasional" }, { label: "Daily Cost" }]}
        actions={
          <Link href="/daily-cost/history">
            <Button variant="outline" size="sm">
              <History className="h-4 w-4" />
              Riwayat Submit
            </Button>
          </Link>
        }
      />

      <div className="space-y-6 p-4 md:p-6">
        <PersonaBanner
          persona={persona}
          scopeSummary={`${workspace.projectCode} · ${workspace.locationName}`}
        />

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
              Kategori cost menyesuaikan konfigurasi project lokasi terpilih.
            </span>
          </div>
        )}

        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Aturan Cut-Off <b>H+1</b>: transaksi hanya dapat diinput untuk hari ini ({today}) atau
            kemarin ({yesterday}). Kategori mengikuti konfigurasi project{" "}
            <b>{workspace.projectCode}</b>.
          </span>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Status Submit — {workspace.locationName}</CardTitle>
            <CardDescription>
              Tanggal yang belum di-submit ditandai merah agar tidak terlewat sebelum cut-off.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <MissingSubmissionStrip submittedIsos={submittedIsos} />
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-primary" />
                Form Daily Cost
              </CardTitle>
              <CardDescription>
                Isi nominal per kategori (Rupiah). Kosongkan yang tidak ada.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isPeriodLocked && (
                <div className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
                  <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    Periode <b>{date.slice(0, 7)}</b> terkunci — form dalam mode hanya-baca. Input
                    ditutup setelah cut-off.
                  </span>
                </div>
              )}

              {!isPeriodLocked && inputWindowPassed && (
                <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    Periode input untuk <b>{date}</b> sudah terlewat (aturan H+1). Form hanya-baca —
                    pilih tanggal hari ini atau kemarin untuk input.
                  </span>
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Tanggal</label>
                  <Input
                    type="date"
                    value={date}
                    max={today}
                    onChange={(e) => setDate(e.target.value)}
                  />
                  {touched && !dateAllowed && (
                    <p className="mt-1 text-[11px] text-rose-600">
                      Tanggal di luar aturan H+1 — pilih hari ini atau kemarin.
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {categories.map((cat) => {
                  const err = errors.find((e) => e.key === cat.key);
                  return (
                    <div key={cat.key}>
                      <label className="mb-1 flex items-center justify-between text-xs font-medium">
                        <span>{cat.label}</span>
                        {cat.requiresProof && (
                          <span className="text-[10px] font-normal text-muted-foreground">
                            perlu bukti
                          </span>
                        )}
                      </label>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        placeholder="0"
                        disabled={readOnly}
                        value={Number.isNaN(values[cat.key]) || values[cat.key] === undefined ? "" : values[cat.key]}
                        onChange={(e) => setValue(cat.key, e.target.value)}
                        className={cn(touched && err && "border-rose-400 focus:ring-rose-400", readOnly && "opacity-60")}
                      />
                      {cat.hint && <p className="mt-0.5 text-[10px] text-muted-foreground">{cat.hint}</p>}
                      {touched && err && <p className="mt-0.5 text-[11px] text-rose-600">{err.message}</p>}
                      {cat.requiresProof && (values[cat.key] || 0) > 0 && (
                        <div className="mt-1 flex items-center gap-2">
                          <label
                            className={cn(
                              "inline-flex cursor-pointer items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-medium hover:bg-accent",
                              touched && missingProofKeys.includes(cat.key) && "border-rose-400 text-rose-600",
                              readOnly && "pointer-events-none opacity-60",
                            )}
                          >
                            <Paperclip className="h-3 w-3" />
                            {proofs[cat.key] ? "Ganti bukti" : "Unggah bukti"}
                            <input
                              type="file"
                              accept="image/*,.pdf"
                              className="hidden"
                              disabled={readOnly}
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) setProof(cat.key, f);
                                e.target.value = "";
                              }}
                            />
                          </label>
                          {proofs[cat.key] ? (
                            <button
                              type="button"
                              onClick={() => setPreviewProof(proofs[cat.key])}
                              className="inline-flex items-center gap-1.5 rounded-md border px-1.5 py-1 hover:bg-accent"
                              title="Lihat preview bukti"
                            >
                              {proofs[cat.key].isImage && proofs[cat.key].url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={proofs[cat.key].url}
                                  alt={proofs[cat.key].name}
                                  className="h-6 w-6 rounded object-cover"
                                />
                              ) : (
                                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                              )}
                              <span className="max-w-[100px] truncate text-[10px] text-emerald-700">
                                {proofs[cat.key].name}
                              </span>
                            </button>
                          ) : (
                            touched && missingProofKeys.includes(cat.key) && (
                              <span className="text-[10px] text-rose-600">bukti wajib</span>
                            )
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {touched && formError && (
                <div className="flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {formError.message}
                </div>
              )}

              {touched && missingProofKeys.length > 0 && (
                <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  <Paperclip className="h-3.5 w-3.5" />
                  {missingProofKeys.length} kategori butuh bukti sebelum submit final.
                </div>
              )}

              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-md border p-2.5">
                  <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Kategori Terisi</div>
                  <div className="mt-0.5 text-sm font-semibold tabular-nums">
                    {categories.filter((c) => (values[c.key] || 0) > 0).length} / {categories.length}
                  </div>
                </div>
                <div className="rounded-md border p-2.5">
                  <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Total Form</div>
                  <div className="mt-0.5 text-sm font-semibold tabular-nums">{formatCurrency(total)}</div>
                </div>
                <div className="rounded-md border border-primary/30 bg-primary/5 p-2.5">
                  <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Total Sesi + Form</div>
                  <div className="mt-0.5 text-sm font-semibold tabular-nums">
                    {formatCurrency(sessionTotals.all + (editingId ? 0 : total))}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between border-t pt-3">
                <div className="text-sm">
                  <span className="text-muted-foreground">Total: </span>
                  <span className="font-semibold tabular-nums">{formatCurrency(total)}</span>
                </div>
                <div className="flex items-center gap-2">
                  {editingId && (
                    <Button variant="ghost" size="sm" onClick={cancelEdit}>
                      Batal
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={readOnly}
                    onClick={() => handleSubmit("draft")}
                  >
                    Simpan Draft
                  </Button>
                  <Button
                    size="sm"
                    disabled={readOnly || missingProofKeys.length > 0}
                    onClick={() => handleSubmit("submitted")}
                  >
                    <Save className="h-4 w-4" />
                    {editingId ? "Update" : "Submit"}
                  </Button>
                </div>
              </div>
              {!canCreate && (
                <p className="text-[11px] text-muted-foreground">
                  Peran {persona.roleLabel} tidak memiliki izin input Daily Cost.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <CardTitle>Daftar Transaksi</CardTitle>
                  <CardDescription>
                    {saveNote ?? "Tersimpan ke database Neon"}{sessionTotals.count > 0 ? ` · ${sessionTotals.count} entri` : ""}.
                  </CardDescription>
                </div>
                <Link href={`/riwayat-perubahan-pengeluaran?location=${workspace.locationId}`}>
                  <Button size="sm" variant="outline">
                    <History className="h-4 w-4" />
                    Buka Riwayat Perubahan
                  </Button>
                </Link>
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                {(["current", "all"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setEntryScope(s)}
                    className={cn(
                      "rounded-md border px-2 py-1 text-[11px] font-medium",
                      entryScope === s
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input bg-background hover:bg-accent",
                    )}
                  >
                    {s === "current" ? workspace.locationName : "Semua lokasi"}
                  </button>
                ))}
              </div>
            </CardHeader>
            <CardContent>
              {visibleEntries.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
                  <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
                  Belum ada entri Daily Cost.
                </div>
              ) : (
                <>
                  <div className="mb-3 grid grid-cols-2 gap-2">
                    <div className="rounded-md border bg-primary/5 p-2.5">
                      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        Total Sesi
                      </div>
                      <div className="mt-0.5 text-sm font-semibold tabular-nums">
                        {formatCurrency(sessionTotals.all)}
                      </div>
                    </div>
                    <div className="rounded-md border p-2.5">
                      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        Sudah Submit
                      </div>
                      <div className="mt-0.5 text-sm font-semibold tabular-nums text-emerald-700">
                        {formatCurrency(sessionTotals.submitted)}
                      </div>
                    </div>
                  </div>
                  <ul className="space-y-2">
                    {visibleEntries.map((entry) => (
                      <li
                        key={entry.id}
                        className={cn(
                          "rounded-md border p-2.5",
                          editingId === entry.id && "border-primary ring-1 ring-primary",
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium tabular-nums">
                            {entry.date}
                            {entryScope === "all" && (
                              <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">
                                · {entry.locationName}
                              </span>
                            )}
                          </span>
                          <Badge variant={entry.status === "submitted" ? "success" : "muted"}>
                            {entry.status === "submitted" ? "Submitted" : "Draft"}
                          </Badge>
                        </div>
                        <div className="mt-1 text-sm font-semibold tabular-nums">
                          {formatCurrency(entry.total)}
                        </div>
                        <ul className="mt-1 space-y-0.5 text-[11px] text-muted-foreground">
                          {entry.breakdown.map((b) => (
                            <li key={b.label} className="flex justify-between">
                              <span className="flex items-center gap-1">
                                {b.label}
                                {b.proof && <Paperclip className="h-2.5 w-2.5 text-emerald-600" />}
                              </span>
                              <span className="tabular-nums">{formatCurrency(b.amount)}</span>
                            </li>
                          ))}
                        </ul>
                        {canCreate && (
                          <div className="mt-2 flex items-center justify-end gap-3 border-t pt-2">
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
                  <div className="mt-2 flex items-center justify-between border-t pt-2 text-sm font-medium">
                    <span>Total Otomatis</span>
                    <span className="tabular-nums">{formatCurrency(sessionTotals.all)}</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {categoryTotals.arr.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Ringkasan Cost per Kategori</CardTitle>
              <CardDescription>
                Agregat pengeluaran sesi ini per kategori · total {formatCurrency(categoryTotals.grand)}.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {categoryTotals.arr.map((c) => {
                  const pct = categoryTotals.grand > 0 ? (c.amount / categoryTotals.grand) * 100 : 0;
                  return (
                    <div key={c.label} className="flex items-center gap-3">
                      <div className="w-40 shrink-0 truncate text-xs font-medium">{c.label}</div>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="w-12 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
                        {pct.toFixed(0)}%
                      </div>
                      <div className="w-28 shrink-0 text-right text-xs tabular-nums font-medium">
                        {formatCurrency(c.amount)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Status Submit per Site</CardTitle>
            <CardDescription>
              Progress Daily Closing (Draft → Submitted → Reviewed → Approved → Locked) untuk site
              dalam scope Anda.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <SubmitStatusList rows={submitStatus} />
          </CardContent>
        </Card>

        <BuktiPanel
          projectCode={workspace.projectCode}
          locationId={workspace.locationId}
          title={`Bukti Pengeluaran — ${workspace.locationName}`}
        />
      </div>

      <Dialog
        open={previewProof !== null}
        onClose={() => setPreviewProof(null)}
        title="Preview Bukti"
        description={previewProof?.name}
      >
        {previewProof?.isImage && previewProof.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewProof.url}
            alt={previewProof.name}
            className="mx-auto max-h-[60vh] w-auto rounded-md border"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
            <FileText className="h-10 w-10 text-muted-foreground" />
            <div>Preview tidak tersedia untuk tipe file ini.</div>
            <div className="text-xs">{previewProof?.name}</div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
