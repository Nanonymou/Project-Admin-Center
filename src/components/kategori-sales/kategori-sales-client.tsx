"use client";

import { useMemo, useState } from "react";
import { ListChecks, MapPin, Tag, TrendingUp, TrendingDown, Plus, Pencil } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { usePersona } from "@/components/providers/persona-provider";
import { canAccessLocation, type Persona } from "@/lib/personas";
import { formatCurrency } from "@/lib/utils";
import { MOCK_WORKSPACES } from "@/lib/mock/workspaces";
import { getServiceCategories } from "@/lib/mock/service-config";
import { getPriceFor } from "@/lib/mock/pricing-config";

type CategoryRow = {
  key: string;
  label: string;
  unit: string;
  price: number;
  deduction: boolean;
  custom?: boolean;
};

/** Field overrides applied on top of a base/custom category, keyed by category key. */
type CategoryOverride = Partial<Pick<CategoryRow, "label" | "unit" | "price" | "deduction">>;

/** Site admins/leaders can manage categories; viewers get a read-only list. */
function canEditCategories(persona: Persona): boolean {
  return persona.role !== "viewer";
}

/**
 * Kategori Sales — the config-driven list of sales service categories per
 * project (PRD §Master Data / Service Category matrix). Categories are sourced
 * from the service config keyed by project code; leaders/admins can add custom
 * categories or edit existing ones (session-local, per project). Shows each
 * category's unit, type (revenue vs deduction), and the site's effective price
 * from Master Pricing. Persona-scoped.
 */
export function KategoriSalesClient() {
  const { persona } = usePersona();

  const workspaces = useMemo(
    () => MOCK_WORKSPACES.filter((w) => canAccessLocation(persona, w.locationId, w.projectCode)),
    [persona],
  );
  const [wsIndex, setWsIndex] = useState(0);
  const ws = workspaces[wsIndex] ?? workspaces[0];
  const [query, setQuery] = useState("");
  const editable = canEditCategories(persona);

  // Session-local edits keyed by project code (categories are per-project).
  const projectKey = ws?.projectCode ?? "";
  const [overrides, setOverrides] = useState<Record<string, Record<string, CategoryOverride>>>({});
  const [customCats, setCustomCats] = useState<Record<string, CategoryRow[]>>({});
  const projOverrides = overrides[projectKey] ?? {};
  const projCustom = customCats[projectKey] ?? [];

  // Form/dialog state.
  const [formOpen, setFormOpen] = useState(false);
  const [editKey, setEditKey] = useState<string | null>(null); // null = add new
  const [formLabel, setFormLabel] = useState("");
  const [formUnit, setFormUnit] = useState("");
  const [formPrice, setFormPrice] = useState("");
  const [formDeduction, setFormDeduction] = useState(false);

  const categories: CategoryRow[] = useMemo(() => {
    if (!ws) return [];
    const base: CategoryRow[] = getServiceCategories(ws.projectCode).map((c) => {
      const ov = projOverrides[c.key] ?? {};
      return {
        key: c.key,
        label: ov.label ?? c.label,
        unit: ov.unit ?? c.unit,
        price: ov.price ?? getPriceFor(ws.projectCode, ws.locationId, c.key),
        deduction: ov.deduction ?? Boolean(c.deduction),
      };
    });
    const custom: CategoryRow[] = projCustom.map((c) => ({ ...c, ...(projOverrides[c.key] ?? {}) }));
    const all = [...base, ...custom];
    const q = query.trim().toLowerCase();
    return all.filter((c) => !q || c.label.toLowerCase().includes(q) || c.key.includes(q));
  }, [ws, query, projOverrides, projCustom]);

  const revenueCount = categories.filter((c) => !c.deduction).length;
  const deductionCount = categories.filter((c) => c.deduction).length;

  function openAdd() {
    setEditKey(null);
    setFormLabel("");
    setFormUnit("");
    setFormPrice("");
    setFormDeduction(false);
    setFormOpen(true);
  }

  function openEdit(row: CategoryRow) {
    setEditKey(row.key);
    setFormLabel(row.label);
    setFormUnit(row.unit);
    setFormPrice(String(row.price));
    setFormDeduction(row.deduction);
    setFormOpen(true);
  }

  function saveForm() {
    const label = formLabel.trim();
    if (!label) return;
    const price = Math.max(0, Math.round(Number(formPrice) || 0));
    const unit = formUnit.trim() || "unit";
    if (editKey) {
      setOverrides((prev) => ({
        ...prev,
        [projectKey]: {
          ...(prev[projectKey] ?? {}),
          [editKey]: { label, unit, price, deduction: formDeduction },
        },
      }));
    } else {
      const key = `custom_${label.toLowerCase().replace(/[^a-z0-9]+/g, "_")}_${Date.now()}`;
      setCustomCats((prev) => ({
        ...prev,
        [projectKey]: [...(prev[projectKey] ?? []), { key, label, unit, price, deduction: formDeduction, custom: true }],
      }));
    }
    setFormOpen(false);
  }

  if (!ws) {
    return (
      <div>
        <PageHeader title="Kategori Sales" description="Daftar kategori penjualan per site." />
        <div className="p-6 text-sm text-muted-foreground">Tidak ada site dalam cakupan Anda.</div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Kategori Sales"
        description={`Kategori penjualan (config-driven) · ${ws.projectName} · ${ws.locationName}`}
        breadcrumbs={[{ label: "Master Data" }, { label: "Kategori Sales" }]}
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
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari kategori…"
            className="h-8 w-44 text-xs"
          />
          <div className="ml-auto flex items-center gap-2">
            <Badge variant="success" className="gap-1">
              <TrendingUp className="h-3 w-3" />
              {revenueCount} penjualan
            </Badge>
            {deductionCount > 0 && (
              <Badge variant="danger" className="gap-1">
                <TrendingDown className="h-3 w-3" />
                {deductionCount} potongan
              </Badge>
            )}
            {editable && (
              <Button size="sm" onClick={openAdd} className="gap-1.5">
                <Plus className="h-4 w-4" />
                Tambah Kategori
              </Button>
            )}
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-primary" />
              Daftar Kategori — {ws.projectName}
            </CardTitle>
            <CardDescription>
              Kategori layanan penjualan yang aktif untuk project ini, beserta harga master per site.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {categories.length === 0 ? (
              <div className="rounded-md border border-dashed py-6 text-center text-sm text-muted-foreground">
                Tidak ada kategori yang cocok.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="px-3 py-2 font-medium">Kategori</th>
                      <th className="px-3 py-2 font-medium">Kode</th>
                      <th className="px-3 py-2 font-medium">Satuan</th>
                      <th className="px-3 py-2 font-medium">Tipe</th>
                      <th className="px-3 py-2 text-right font-medium">Harga Master</th>
                      {editable && <th className="px-3 py-2 text-right font-medium">Aksi</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map((c) => (
                      <tr key={c.key} className="border-b last:border-b-0">
                        <td className="px-3 py-2 font-medium">
                          {c.label}
                          {c.custom && (
                            <Badge variant="success" className="ml-2">
                              Kustom
                            </Badge>
                          )}
                          {!c.custom && c.key in projOverrides && (
                            <Badge variant="warning" className="ml-2">
                              Diubah
                            </Badge>
                          )}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{c.key}</td>
                        <td className="px-3 py-2">
                          <Badge variant="info" className="gap-1">
                            <Tag className="h-3 w-3" />
                            {c.unit}
                          </Badge>
                        </td>
                        <td className="px-3 py-2">
                          {c.deduction ? (
                            <Badge variant="danger">Potongan</Badge>
                          ) : (
                            <Badge variant="success">Penjualan</Badge>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold tabular-nums">
                          {c.deduction ? "−" : ""}
                          {formatCurrency(c.price)}
                        </td>
                        {editable && (
                          <td className="px-3 py-2 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEdit(c)}
                              className="h-7 gap-1 px-2"
                            >
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
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editKey ? "Ubah Kategori" : "Tambah Kategori"}
        description={
          editKey
            ? "Perbarui detail kategori penjualan (berlaku untuk project terpilih)."
            : "Tambahkan kategori penjualan baru untuk project terpilih."
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
            <label className="text-xs font-medium text-muted-foreground">Nama Kategori</label>
            <Input
              value={formLabel}
              onChange={(e) => setFormLabel(e.target.value)}
              placeholder="mis. Meals Buffet"
              className="h-9"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Satuan</label>
              <Input
                value={formUnit}
                onChange={(e) => setFormUnit(e.target.value)}
                placeholder="mis. porsi"
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Harga Master (Rp)</label>
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
            Kategori potongan (mengurangi total penjualan, mis. Backcharge)
          </label>
          {Number(formPrice) > 0 && (
            <div className="text-xs text-muted-foreground">
              {formDeduction ? "−" : ""}
              {formatCurrency(Number(formPrice))}
            </div>
          )}
        </div>
      </Dialog>
    </div>
  );
}
