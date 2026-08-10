"use client";

import { useMemo, useState } from "react";
import { UtensilsCrossed, MapPin, Tag, Pencil, Plus, Ban, RotateCcw, History } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { usePersona } from "@/components/providers/persona-provider";
import { canAccessLocation, type Persona } from "@/lib/personas";
import { formatCurrency } from "@/lib/utils";
import { MOCK_WORKSPACES } from "@/lib/mock/workspaces";
import { getPricedCategories, type PricedCategory } from "@/lib/mock/pricing-config";

type PriceRow = { key: string; label: string; unit: string; price: number; custom?: boolean };

type PriceHistoryEntry = {
  id: string;
  at: string;
  actor: string;
  category: string;
  action: "Tambah" | "Ubah" | "Nonaktifkan" | "Aktifkan";
  detail: string;
};

function nowLabel(): string {
  return new Date().toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Site admins/leaders can edit prices; viewers get a read-only list. */
function canEditPrices(persona: Persona): boolean {
  return persona.role !== "viewer";
}

/**
 * Harga Meals — default price list per site. The site picker chooses a workspace;
 * prices come from the config-driven master pricing (per-location multiplier), so
 * each site shows its own default meal prices without hardcoding. Meal categories
 * (buffet/packmeal/snack/…) are surfaced first; other service categories are
 * shown separately. Read-only view; persona-scoped.
 */
export function HargaMealsClient() {
  const { persona } = usePersona();

  const workspaces = useMemo(
    () => MOCK_WORKSPACES.filter((w) => canAccessLocation(persona, w.locationId, w.projectCode)),
    [persona],
  );
  const [wsIndex, setWsIndex] = useState(0);
  const ws = workspaces[wsIndex] ?? workspaces[0];

  const baseCategories: PricedCategory[] = useMemo(
    () => (ws ? getPricedCategories(ws.projectCode, ws.locationId).filter((c) => !c.deduction) : []),
    [ws],
  );

  // Session-local edits: price overrides (by category key) + custom-added rows.
  // Keyed by site so switching sites shows that site's own edits.
  const siteKey = ws?.locationId ?? "";
  const [overrides, setOverrides] = useState<Record<string, Record<string, number>>>({});
  const [customRows, setCustomRows] = useState<Record<string, PriceRow[]>>({});
  // Deactivated category keys per site — a price kept for reference but marked
  // inactive so it is excluded from active pricing.
  const [inactive, setInactive] = useState<Record<string, string[]>>({});
  // Session-local change history per site (newest first).
  const [history, setHistory] = useState<Record<string, PriceHistoryEntry[]>>({});
  const siteOverrides = overrides[siteKey] ?? {};
  const siteCustom = customRows[siteKey] ?? [];
  const siteInactive = inactive[siteKey] ?? [];
  const siteHistory = history[siteKey] ?? [];

  function logHistory(entry: Omit<PriceHistoryEntry, "id" | "at" | "actor">) {
    setHistory((prev) => ({
      ...prev,
      [siteKey]: [
        { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, at: nowLabel(), actor: persona.name, ...entry },
        ...(prev[siteKey] ?? []),
      ],
    }));
  }

  function isInactive(key: string): boolean {
    return siteInactive.includes(key);
  }

  function toggleActive(key: string, label: string) {
    const willDeactivate = !siteInactive.includes(key);
    setInactive((prev) => {
      const cur = prev[siteKey] ?? [];
      const next = cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key];
      return { ...prev, [siteKey]: next };
    });
    logHistory({
      category: label,
      action: willDeactivate ? "Nonaktifkan" : "Aktifkan",
      detail: willDeactivate ? "Harga dinonaktifkan." : "Harga diaktifkan kembali.",
    });
  }

  const editable = canEditPrices(persona);

  // Form/dialog state.
  const [formOpen, setFormOpen] = useState(false);
  const [editKey, setEditKey] = useState<string | null>(null); // null = add new
  const [formLabel, setFormLabel] = useState("");
  const [formUnit, setFormUnit] = useState("");
  const [formPrice, setFormPrice] = useState("");

  function priceOf(row: PriceRow): number {
    return siteOverrides[row.key] ?? row.price;
  }

  const rows: PriceRow[] = useMemo(() => {
    const base = baseCategories.map<PriceRow>((c) => ({
      key: c.key,
      label: c.label,
      unit: c.unit,
      price: c.price,
    }));
    return [...base, ...siteCustom];
  }, [baseCategories, siteCustom]);

  // Meal categories float to the top; everything else is a general service.
  const isMeal = (key: string) =>
    key.startsWith("meals") || key === "snack_box" || key === "air_minum";
  const meals = rows.filter((c) => isMeal(c.key));
  const others = rows.filter((c) => !isMeal(c.key));

  function openEdit(row: PriceRow) {
    setEditKey(row.key);
    setFormLabel(row.label);
    setFormUnit(row.unit);
    setFormPrice(String(priceOf(row)));
    setFormOpen(true);
  }

  function openAdd() {
    setEditKey(null);
    setFormLabel("");
    setFormUnit("");
    setFormPrice("");
    setFormOpen(true);
  }

  function saveForm() {
    const price = Math.max(0, Math.round(Number(formPrice) || 0));
    if (editKey) {
      // Editing an existing/custom row → record a price override for this site.
      const prevRow = rows.find((r) => r.key === editKey);
      const oldPrice = prevRow ? priceOf(prevRow) : 0;
      setOverrides((prev) => ({
        ...prev,
        [siteKey]: { ...(prev[siteKey] ?? {}), [editKey]: price },
      }));
      if (oldPrice !== price) {
        logHistory({
          category: formLabel,
          action: "Ubah",
          detail: `Harga ${formatCurrency(oldPrice)} → ${formatCurrency(price)}.`,
        });
      }
    } else {
      // Adding a new custom category for this site.
      const label = formLabel.trim();
      if (!label) return;
      const key = `custom_${label.toLowerCase().replace(/[^a-z0-9]+/g, "_")}_${Date.now()}`;
      setCustomRows((prev) => ({
        ...prev,
        [siteKey]: [...(prev[siteKey] ?? []), { key, label, unit: formUnit.trim() || "unit", price, custom: true }],
      }));
      logHistory({
        category: label,
        action: "Tambah",
        detail: `Kategori baru ditambahkan · ${formatCurrency(price)}/${formUnit.trim() || "unit"}.`,
      });
    }
    setFormOpen(false);
  }

  if (!ws) {
    return (
      <div>
        <PageHeader title="Harga Meals" description="Daftar harga default meals per site." />
        <div className="p-6 text-sm text-muted-foreground">Tidak ada site dalam cakupan Anda.</div>
      </div>
    );
  }

  function priceTable(list: PriceRow[], emptyLabel: string) {
    if (list.length === 0) {
      return (
        <div className="rounded-md border border-dashed py-6 text-center text-sm text-muted-foreground">
          {emptyLabel}
        </div>
      );
    }
    return (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[460px] text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="px-3 py-2 font-medium">Kategori</th>
              <th className="px-3 py-2 font-medium">Satuan</th>
              <th className="px-3 py-2 text-right font-medium">Harga</th>
              {editable && <th className="px-3 py-2 text-right font-medium">Aksi</th>}
            </tr>
          </thead>
          <tbody>
            {list.map((c) => {
              const edited = c.key in siteOverrides;
              const off = isInactive(c.key);
              return (
                <tr key={c.key} className={`border-b last:border-b-0 ${off ? "opacity-50" : ""}`}>
                  <td className="px-3 py-2 font-medium">
                    <span className={off ? "line-through" : ""}>{c.label}</span>
                    {c.custom && (
                      <Badge variant="success" className="ml-2">
                        Kustom
                      </Badge>
                    )}
                    {edited && !c.custom && (
                      <Badge variant="warning" className="ml-2">
                        Diubah
                      </Badge>
                    )}
                    {off && (
                      <Badge variant="danger" className="ml-2">
                        Nonaktif
                      </Badge>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant="info" className="gap-1">
                      <Tag className="h-3 w-3" />
                      {c.unit}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">
                    {formatCurrency(priceOf(c))}
                  </td>
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
                          onClick={() => toggleActive(c.key, c.label)}
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
    );
  }

  return (
    <div>
      <PageHeader
        title="Harga Meals"
        description={`Daftar harga default (config-driven) · ${ws.projectName} · ${ws.locationName}`}
        breadcrumbs={[{ label: "Master Data" }, { label: "Harga Meals" }]}
      />

      <div className="space-y-6 p-4 md:p-6">
        <PersonaBanner persona={persona} scopeSummary={`${workspaces.length} site`} />

        <div className="flex flex-wrap items-center gap-3">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <label className="text-xs text-muted-foreground">Site</label>
          <select
            value={wsIndex}
            onChange={(e) => setWsIndex(Number(e.target.value))}
            className="h-8 rounded-md border bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-ring"
          >
            {workspaces.map((w, i) => (
              <option key={w.locationId} value={i}>
                {w.projectName} — {w.locationName} ({w.projectCode})
              </option>
            ))}
          </select>
          <Badge variant="default" className="ml-auto">
            {rows.length - siteInactive.length} aktif / {rows.length} kategori
          </Badge>
          {editable && (
            <Button size="sm" onClick={openAdd} className="gap-1.5">
              <Plus className="h-4 w-4" />
              Tambah Harga
            </Button>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UtensilsCrossed className="h-4 w-4 text-primary" />
              Harga Meals — {ws.locationName}
            </CardTitle>
            <CardDescription>Harga default kategori meals untuk site ini.</CardDescription>
          </CardHeader>
          <CardContent>{priceTable(meals, "Tidak ada kategori meals untuk site ini.")}</CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-primary" />
              Layanan Lainnya
            </CardTitle>
            <CardDescription>Harga default kategori layanan non-meals.</CardDescription>
          </CardHeader>
          <CardContent>{priceTable(others, "Tidak ada kategori layanan lain.")}</CardContent>
        </Card>

        {/* Price change history */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-4 w-4 text-primary" />
              Riwayat Perubahan Harga
            </CardTitle>
            <CardDescription>
              {siteHistory.length === 0
                ? "Belum ada perubahan pada sesi ini."
                : `${siteHistory.length} perubahan · ${ws.locationName}.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {siteHistory.length === 0 ? (
              <div className="rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">
                Perubahan harga (tambah/ubah/nonaktifkan) akan tercatat di sini.
              </div>
            ) : (
              <ul className="space-y-2">
                {siteHistory.map((h) => {
                  const variant =
                    h.action === "Tambah"
                      ? "success"
                      : h.action === "Ubah"
                        ? "warning"
                        : h.action === "Nonaktifkan"
                          ? "danger"
                          : "info";
                  return (
                    <li
                      key={h.id}
                      className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border bg-card px-3 py-2 text-sm"
                    >
                      <Badge variant={variant}>{h.action}</Badge>
                      <span className="font-medium">{h.category}</span>
                      <span className="text-xs text-muted-foreground">{h.detail}</span>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {h.actor} · {h.at}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editKey ? "Ubah Harga" : "Tambah Harga"}
        description={
          editKey
            ? "Perbarui harga untuk kategori ini (berlaku untuk site terpilih)."
            : "Tambahkan kategori harga baru untuk site terpilih."
        }
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
            <label className="text-xs font-medium text-muted-foreground">Kategori</label>
            <input
              value={formLabel}
              onChange={(e) => setFormLabel(e.target.value)}
              disabled={Boolean(editKey)}
              placeholder="mis. Meals Buffet"
              className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Satuan</label>
            <input
              value={formUnit}
              onChange={(e) => setFormUnit(e.target.value)}
              disabled={Boolean(editKey)}
              placeholder="mis. porsi"
              className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Harga (Rupiah)</label>
            <input
              type="number"
              min={0}
              value={formPrice}
              onChange={(e) => setFormPrice(e.target.value)}
              placeholder="0"
              className="h-9 w-full rounded-md border bg-background px-3 text-sm tabular-nums outline-none focus:ring-2 focus:ring-ring"
            />
            {Number(formPrice) > 0 && (
              <div className="text-xs text-muted-foreground">{formatCurrency(Number(formPrice))}</div>
            )}
          </div>
        </div>
      </Dialog>
    </div>
  );
}
