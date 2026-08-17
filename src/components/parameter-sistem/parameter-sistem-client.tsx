"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  SlidersHorizontal,
  Search,
  ToggleRight,
  ToggleLeft,
  Hash,
  Type,
  List,
  Pencil,
  History,
  ArrowRight,
} from "lucide-react";
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
  listSystemParameters,
  formatParameterValue,
  validateParameterValue,
  PARAMETER_GROUPS,
  type ParameterType,
  type SystemParameter,
} from "@/lib/mock/system-parameters";

const TYPE_ICON: Record<ParameterType, typeof Hash> = {
  number: Hash,
  text: Type,
  boolean: ToggleRight,
  select: List,
};

const TYPE_LABEL: Record<ParameterType, string> = {
  number: "Angka",
  text: "Teks",
  boolean: "Ya/Tidak",
  select: "Pilihan",
};

/**
 * Parameter Sistem — global application settings (config-driven), grouped by
 * concern (Umum, Keuangan, Notifikasi, Keamanan, Penyimpanan). These are
 * app-level parameters, distinct from per-project business config. Read-only
 * here; editing, validation, and a change-history panel are layered on by later
 * tasks. Persona-scoped view.
 */
export function ParameterSistemClient() {
  const { persona } = usePersona();
  const editable = persona.capabilities.canConfigure;
  const [query, setQuery] = useState("");

  // Value overrides keyed by parameter key (seeded from the DB, then edited).
  const [overrides, setOverrides] = useState<Record<string, SystemParameter["value"]>>({});
  const [saveNote, setSaveNote] = useState<string | null>(null);
  const valueOf = (p: SystemParameter) => overrides[p.key] ?? p.value;
  const isEdited = (key: string) => key in overrides;

  // Seed the displayed values from the persisted DB parameters.
  const loadParams = useCallback(async () => {
    try {
      const res = await fetch("/api/parameter-sistem", { cache: "no-store", headers: personaHeaders(persona.id) });
      const data = (await res.json()) as {
        source?: string;
        parameters?: Array<{ key: string; value: SystemParameter["value"] }>;
      };
      if (data.source !== "db" || !Array.isArray(data.parameters)) return;
      const map: Record<string, SystemParameter["value"]> = {};
      for (const p of data.parameters) map[p.key] = p.value;
      setOverrides(map);
    } catch {
      /* keep config defaults */
    }
  }, [persona.id]);

  useEffect(() => {
    void loadParams();
  }, [loadParams]);

  async function persistParam(key: string, value: SystemParameter["value"]) {
    try {
      const res = await fetch("/api/parameter-sistem", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...personaHeaders(persona.id) },
        body: JSON.stringify({ key, value }),
      });
      const data = (await res.json().catch(() => ({}))) as { source?: string; error?: string };
      setSaveNote(res.ok && data.source === "db" ? "Tersimpan ke database ✓" : res.ok ? "Tersimpan di sesi ini." : data.error ?? "Gagal menyimpan.");
    } catch {
      setSaveNote("Tersimpan di sesi ini (jaringan bermasalah).");
    }
  }

  // Change-history log (this session), newest first.
  const [history, setHistory] = useState<
    { id: string; label: string; before: string; after: string; editor: string; at: string }[]
  >([]);

  const params = useMemo(() => {
    const q = query.trim().toLowerCase();
    return listSystemParameters().filter(
      (p) => !q || p.label.toLowerCase().includes(q) || p.key.includes(q),
    );
  }, [query]);

  // Edit modal state.
  const [editParam, setEditParam] = useState<SystemParameter | null>(null);
  const [draft, setDraft] = useState("");
  const [draftBool, setDraftBool] = useState(false);
  const error = editParam ? validateParameterValue(editParam, draft) : null;

  function openEdit(p: SystemParameter) {
    setEditParam(p);
    const current = valueOf(p);
    if (p.type === "boolean") setDraftBool(Boolean(current));
    else setDraft(String(current));
  }

  function recordChange(p: SystemParameter, before: SystemParameter["value"], after: SystemParameter["value"]) {
    if (formatParameterValue(p, before) === formatParameterValue(p, after)) return;
    setHistory((prev) => [
      {
        id: `${p.key}-${Date.now()}`,
        label: p.label,
        before: formatParameterValue(p, before),
        after: formatParameterValue(p, after),
        editor: persona.name,
        at: new Date().toISOString(),
      },
      ...prev,
    ]);
  }

  function saveEdit() {
    if (!editParam) return;
    const before = valueOf(editParam);
    const key = editParam.key;
    if (editParam.type === "boolean") {
      setOverrides((prev) => ({ ...prev, [key]: draftBool }));
      recordChange(editParam, before, draftBool);
      void persistParam(key, draftBool);
    } else {
      if (validateParameterValue(editParam, draft)) return;
      const value = editParam.type === "number" ? Number(draft) : draft;
      setOverrides((prev) => ({ ...prev, [key]: value }));
      recordChange(editParam, before, value);
      void persistParam(key, value);
    }
    setEditParam(null);
  }

  const byGroup = useMemo(() => {
    const map = new Map<string, SystemParameter[]>();
    for (const g of PARAMETER_GROUPS) map.set(g, []);
    for (const p of params) map.get(p.group)?.push(p);
    return PARAMETER_GROUPS.map((g) => ({ group: g, items: map.get(g) ?? [] })).filter(
      (x) => x.items.length > 0,
    );
  }, [params]);

  return (
    <div>
      <PageHeader
        title="Parameter Sistem"
        description="Pengaturan global aplikasi (config-driven)."
        breadcrumbs={[{ label: "Master Data" }, { label: "Parameter Sistem" }]}
      />

      <div className="space-y-6 p-4 md:p-6">
        <PersonaBanner persona={persona} scopeSummary={`${listSystemParameters().length} parameter`} />
        {saveNote && <span className="text-xs text-emerald-700">{saveNote}</span>}

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari parameter…"
              className="h-8 w-56 pl-8 text-xs"
            />
          </div>
          <Badge variant="default" className="ml-auto gap-1">
            <SlidersHorizontal className="h-3 w-3" />
            {params.length} parameter
          </Badge>
        </div>

        {byGroup.length === 0 ? (
          <div className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
            Tidak ada parameter yang cocok.
          </div>
        ) : (
          byGroup.map(({ group, items }) => (
            <Card key={group}>
              <CardHeader>
                <CardTitle className="text-base">{group}</CardTitle>
                <CardDescription>{items.length} parameter</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="divide-y">
                  {items.map((p) => {
                    const val = valueOf(p);
                    const Icon = p.type === "boolean" && val === false ? ToggleLeft : TYPE_ICON[p.type];
                    return (
                      <div key={p.key} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{p.label}</span>
                            <Badge variant="muted" className="gap-1">
                              <Icon className="h-3 w-3" />
                              {TYPE_LABEL[p.type]}
                            </Badge>
                            {isEdited(p.key) && <Badge variant="warning">Diubah</Badge>}
                          </div>
                          <p className="mt-0.5 text-xs text-muted-foreground">{p.description}</p>
                          <p className="mt-0.5 font-mono text-[11px] text-muted-foreground/70">{p.key}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2 text-right">
                          {p.type === "boolean" ? (
                            <Badge variant={val ? "success" : "muted"}>{formatParameterValue(p, val)}</Badge>
                          ) : (
                            <span className="text-sm font-semibold tabular-nums">
                              {formatParameterValue(p, val)}
                            </span>
                          )}
                          {editable && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEdit(p)}
                              className="h-7 gap-1 px-2"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Ubah
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="h-4 w-4 text-primary" />
              Riwayat Perubahan Parameter
            </CardTitle>
            <CardDescription>
              {history.length > 0
                ? `${history.length} perubahan pada sesi ini.`
                : "Perubahan parameter pada sesi ini akan tercatat di sini."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <div className="rounded-md border border-dashed py-6 text-center text-sm text-muted-foreground">
                Belum ada perubahan.
              </div>
            ) : (
              <ol className="space-y-3">
                {history.map((h) => (
                  <li key={h.id} className="flex items-start gap-3">
                    <Badge variant="info" className="mt-0.5 shrink-0">
                      Diubah
                    </Badge>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="font-medium">{h.label}</span>
                        <span className="flex items-center gap-1.5 text-xs">
                          <span className="text-muted-foreground line-through">{h.before}</span>
                          <ArrowRight className="h-3 w-3 text-muted-foreground" />
                          <span className="font-medium">{h.after}</span>
                        </span>
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {h.editor} · {formatDateTime(h.at)}
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
        open={editParam !== null}
        onClose={() => setEditParam(null)}
        title={editParam ? `Ubah ${editParam.label}` : "Ubah Parameter"}
        description={editParam?.description}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditParam(null)}>
              Batal
            </Button>
            <Button
              size="sm"
              onClick={saveEdit}
              disabled={editParam !== null && editParam.type !== "boolean" && error !== null}
            >
              Simpan
            </Button>
          </div>
        }
      >
        {editParam && (
          <div className="space-y-2 text-sm">
            <label className="text-xs font-medium text-muted-foreground">Nilai</label>
            {editParam.type === "boolean" ? (
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={draftBool}
                  onChange={(e) => setDraftBool(e.target.checked)}
                  className="h-4 w-4 rounded border-input"
                />
                <span>{draftBool ? "Aktif" : "Nonaktif"}</span>
              </label>
            ) : editParam.type === "select" ? (
              <select
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              >
                {editParam.options?.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : (
              <div className="flex items-center gap-2">
                <Input
                  type={editParam.type === "number" ? "number" : "text"}
                  value={draft}
                  min={editParam.min}
                  max={editParam.max}
                  onChange={(e) => setDraft(e.target.value)}
                  className="h-9"
                />
                {editParam.unit && (
                  <span className="text-xs text-muted-foreground">{editParam.unit}</span>
                )}
              </div>
            )}
            {editParam.type === "number" && (editParam.min !== undefined || editParam.max !== undefined) && (
              <p className="text-[11px] text-muted-foreground">
                Rentang: {editParam.min ?? "—"} – {editParam.max ?? "—"}
                {editParam.unit ? ` ${editParam.unit}` : ""}
              </p>
            )}
            {error && <p className="text-xs text-rose-600">{error}</p>}
          </div>
        )}
      </Dialog>
    </div>
  );
}
