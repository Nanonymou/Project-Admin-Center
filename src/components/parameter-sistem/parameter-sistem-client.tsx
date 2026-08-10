"use client";

import { useMemo, useState } from "react";
import { SlidersHorizontal, Search, ToggleRight, ToggleLeft, Hash, Type, List, Pencil } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { usePersona } from "@/components/providers/persona-provider";
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

  // Session-local value overrides keyed by parameter key.
  const [overrides, setOverrides] = useState<Record<string, SystemParameter["value"]>>({});
  const valueOf = (p: SystemParameter) => overrides[p.key] ?? p.value;
  const isEdited = (key: string) => key in overrides;

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

  function saveEdit() {
    if (!editParam) return;
    if (editParam.type === "boolean") {
      setOverrides((prev) => ({ ...prev, [editParam.key]: draftBool }));
    } else {
      if (validateParameterValue(editParam, draft)) return;
      const value = editParam.type === "number" ? Number(draft) : draft;
      setOverrides((prev) => ({ ...prev, [editParam.key]: value }));
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
