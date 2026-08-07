"use client";

import { Fragment, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, RotateCcw, Trash2, Trash } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { KpiCard } from "@/components/common/kpi-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePersona } from "@/components/providers/persona-provider";
import {
  buildDeletedItems,
  DELETED_TYPE_META,
  type DeletedItem,
  type DeletedType,
} from "@/lib/mock/recycle-bin";
import { cn } from "@/lib/utils";

export function RecycleBinClient() {
  const { persona } = usePersona();
  const canManage = persona.role === "leader_admin" || persona.role === "super_admin";

  const seeded = useMemo(() => buildDeletedItems(), []);
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const [typeFilter, setTypeFilter] = useState<DeletedType | "all">("all");
  const [notice, setNotice] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const items = useMemo(() => seeded.filter((i) => !removedIds.has(i.id)), [seeded, removedIds]);
  const filtered = useMemo(
    () => (typeFilter === "all" ? items : items.filter((i) => i.type === typeFilter)),
    [items, typeFilter],
  );

  const counts = useMemo(
    () => ({
      total: items.length,
      purgingSoon: items.filter((i) => i.daysUntilPurge <= 5).length,
    }),
    [items],
  );

  function restore(it: DeletedItem) {
    setRemovedIds((prev) => new Set(prev).add(it.id));
    setNotice(`"${it.label}" dipulihkan.`);
  }
  function purge(it: DeletedItem) {
    setRemovedIds((prev) => new Set(prev).add(it.id));
    setNotice(`"${it.label}" dihapus permanen.`);
  }

  const allSelected = filtered.length > 0 && filtered.every((i) => selected.has(i.id));
  function toggleSelectAll() {
    setSelected((prev) => {
      if (filtered.every((i) => prev.has(i.id))) {
        const next = new Set(prev);
        filtered.forEach((i) => next.delete(i.id));
        return next;
      }
      const next = new Set(prev);
      filtered.forEach((i) => next.add(i.id));
      return next;
    });
  }
  function bulkAction(kind: "restore" | "purge") {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    setRemovedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
    setNotice(`${ids.length} item ${kind === "restore" ? "dipulihkan" : "dihapus permanen"}.`);
    setSelected(new Set());
  }

  const typeTabs: (DeletedType | "all")[] = ["all", "invoice", "daily_sales", "daily_cost", "user", "master"];

  return (
    <div>
      <PageHeader
        title="Recycle Bin"
        description="Data yang dihapus (soft delete) tersimpan sementara sebelum dibersihkan permanen."
        breadcrumbs={[{ label: "Master Data" }, { label: "Recycle Bin" }]}
      />

      <div className="space-y-6 p-4 md:p-6">
        <PersonaBanner persona={persona} scopeSummary={canManage ? "Akses pulihkan & hapus" : "Hanya-baca"} />

        {notice && (
          <div className="flex items-center justify-between gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">
            <span>{notice}</span>
            <button type="button" onClick={() => setNotice(null)} className="text-sky-700 hover:underline">
              Tutup
            </button>
          </div>
        )}

        <section className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <KpiCard label="Item Terhapus" value={counts.total} format="number" icon={Trash} tone="primary" />
          <KpiCard label="Akan Dibersihkan (≤5 hari)" value={counts.purgingSoon} format="number" icon={Trash2} tone="danger" />
          <KpiCard label="Retensi" value="30 hari" format="text" icon={RotateCcw} tone="muted" />
        </section>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle>Daftar Item Terhapus</CardTitle>
              <CardDescription>Pulihkan atau hapus permanen sebelum masa retensi habis.</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              {typeTabs.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTypeFilter(t)}
                  className={cn(
                    "rounded-md border px-2 py-1 text-[11px] font-medium",
                    typeFilter === t
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-background hover:bg-accent",
                  )}
                >
                  {t === "all" ? "Semua" : DELETED_TYPE_META[t].label}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {canManage && selected.size > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-primary/5 px-3 py-2">
                <span className="text-xs font-medium">{selected.size} item dipilih</span>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" className="h-7" onClick={() => bulkAction("restore")}>
                    <RotateCcw className="h-3.5 w-3.5" />
                    Pulihkan
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-rose-600 hover:text-rose-700" onClick={() => bulkAction("purge")}>
                    <Trash2 className="h-3.5 w-3.5" />
                    Hapus Permanen
                  </Button>
                  <button type="button" onClick={() => setSelected(new Set())} className="text-[11px] text-muted-foreground hover:underline">
                    Batal pilih
                  </button>
                </div>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                    {canManage && (
                      <th className="w-8 px-3 py-2">
                        <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} aria-label="Pilih semua" className="h-4 w-4" />
                      </th>
                    )}
                    <th className="px-3 py-2 text-left font-medium">Item</th>
                    <th className="px-3 py-2 text-left font-medium">Tipe</th>
                    <th className="px-3 py-2 text-left font-medium">Dihapus</th>
                    <th className="px-3 py-2 text-left font-medium">Oleh</th>
                    <th className="px-3 py-2 text-right font-medium">Sisa Retensi</th>
                    <th className="px-3 py-2 text-right font-medium">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={canManage ? 7 : 6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                        Recycle bin kosong untuk filter ini.
                      </td>
                    </tr>
                  )}
                  {filtered.map((it) => {
                    const meta = DELETED_TYPE_META[it.type];
                    const expanded = expandedId === it.id;
                    return (
                    <Fragment key={it.id}>
                      <tr className={cn("border-b last:border-0 hover:bg-muted/30", selected.has(it.id) && "bg-primary/5")}>
                        {canManage && (
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              checked={selected.has(it.id)}
                              onChange={() => toggleSelect(it.id)}
                              aria-label={`Pilih ${it.label}`}
                              className="h-4 w-4"
                            />
                          </td>
                        )}
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            onClick={() => setExpandedId(expanded ? null : it.id)}
                            className="flex items-start gap-1.5 text-left"
                            aria-expanded={expanded}
                          >
                            {expanded ? (
                              <ChevronDown className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            )}
                            <span>
                              <span className="block font-medium">{it.label}</span>
                              <span className="block text-[11px] text-muted-foreground">{it.detail}</span>
                            </span>
                          </button>
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant={meta.variant}>{meta.label}</Badge>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{it.deletedAt}</td>
                        <td className="px-3 py-2 text-muted-foreground">{it.deletedBy}</td>
                        <td className={cn("px-3 py-2 text-right tabular-nums", it.daysUntilPurge <= 5 && "text-rose-600 font-medium")}>
                          {it.daysUntilPurge} hari
                        </td>
                        <td className="px-3 py-2 text-right">
                          <div className="inline-flex items-center gap-2">
                            <Button size="sm" variant="outline" className="h-7" disabled={!canManage} onClick={() => restore(it)}>
                              <RotateCcw className="h-3.5 w-3.5" />
                              Pulihkan
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 text-rose-600 hover:text-rose-700" disabled={!canManage} onClick={() => purge(it)}>
                              <Trash2 className="h-3.5 w-3.5" />
                              Hapus
                            </Button>
                          </div>
                        </td>
                      </tr>
                      {expanded && (
                        <tr className="border-b bg-muted/20">
                          <td colSpan={canManage ? 7 : 6} className="px-3 py-3">
                            <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                              <Meta label="ID Asli" value={it.originalId} />
                              <Meta label="Alasan Hapus" value={it.reason} />
                              <Meta label="Tanggal Pembersihan" value={it.purgeDate} />
                              <Meta label="Scope" value={`${it.projectCode} · ${it.locationName}`} />
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
}
