"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Contact, Building2, Truck, Mail, Phone, MapPin, Search, Plus, Pencil, Ban, RotateCcw } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { CustomerVendorSelect } from "@/components/master-customer-vendor/customer-vendor-select";
import { usePersona } from "@/components/providers/persona-provider";
import { personaHeaders } from "@/lib/client/notif";
import {
  listCustomerVendors,
  PARTY_TYPE_META,
  PARTY_STATUS_META,
  type CustomerVendor,
  type PartyStatus,
  type PartyType,
} from "@/lib/mock/customer-vendor";

type PartyForm = {
  name: string;
  code: string;
  type: PartyType;
  category: string;
  contactPerson: string;
  phone: string;
  email: string;
  city: string;
  npwp: string;
  address: string;
  status: PartyStatus;
};

const EMPTY_FORM: PartyForm = {
  name: "",
  code: "",
  type: "customer",
  category: "",
  contactPerson: "",
  phone: "",
  email: "",
  city: "",
  npwp: "",
  address: "",
  status: "active",
};

/**
 * Master Customer & Vendor — the org-level directory of clients (customers) and
 * suppliers (vendors), config-driven. Read-only list here; search/filter, add/
 * edit, detail, deactivate, and a reusable picker are layered on by later tasks.
 */
export function CustomerVendorClient() {
  const { persona } = usePersona();
  const editable = persona.capabilities.canConfigure;

  // Session-local new parties + field overrides on existing ones.
  const [customParties, setCustomParties] = useState<CustomerVendor[]>([]);
  const [overrides, setOverrides] = useState<Record<string, Partial<CustomerVendor>>>({});
  const [dbParties, setDbParties] = useState<CustomerVendor[] | null>(null);
  const [saveNote, setSaveNote] = useState<string | null>(null);

  const loadParties = useCallback(async () => {
    try {
      const res = await fetch("/api/master-customer-vendor", { cache: "no-store", headers: personaHeaders(persona.id) });
      const data = (await res.json()) as {
        source?: string;
        parties?: Array<{
          code: string;
          name: string;
          type: string;
          category?: string;
          contactPerson?: string;
          phone?: string;
          email?: string;
          city?: string;
          npwp?: string;
          address?: string;
          active?: boolean;
        }>;
      };
      if (data.source !== "db" || !Array.isArray(data.parties)) {
        setDbParties(null); // DB empty/unavailable → fall back to the config feed.
        return;
      }
      setDbParties(
        data.parties.map((r) => ({
          id: r.code,
          code: r.code,
          name: r.name,
          type: r.type as CustomerVendor["type"],
          category: r.category ?? "",
          contactPerson: r.contactPerson ?? "",
          phone: r.phone ?? "",
          email: r.email ?? "",
          city: r.city ?? "",
          npwp: r.npwp ?? "",
          address: r.address ?? "",
          status: r.active === false ? "inactive" : "active",
          createdAt: "",
        })),
      );
    } catch {
      setDbParties(null);
    }
  }, [persona.id]);

  useEffect(() => {
    void loadParties();
  }, [loadParties]);

  const all = useMemo(
    () =>
      [...customParties, ...(dbParties ?? listCustomerVendors())].map((p) =>
        overrides[p.id] ? { ...p, ...overrides[p.id] } : p,
      ),
    [customParties, dbParties, overrides],
  );
  const isEdited = (id: string) => id in overrides;

  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<PartyType | "all">("all");
  const [statusFilter, setStatusFilter] = useState<PartyStatus | "all">("all");

  // Reusable-picker preview.
  const [previewId, setPreviewId] = useState("");
  const previewParty = all.find((p) => p.id === previewId);

  // Detail modal.
  const [detailParty, setDetailParty] = useState<CustomerVendor | null>(null);

  // Deactivate confirmation (activation is immediate).
  const [confirmParty, setConfirmParty] = useState<CustomerVendor | null>(null);

  function setStatus(id: string, status: PartyStatus) {
    setOverrides((prev) => ({ ...prev, [id]: { ...prev[id], status } }));
  }

  function requestToggle(p: CustomerVendor) {
    if (p.status === "active") setConfirmParty(p);
    else {
      setStatus(p.id, "active");
      void persistStatus(p.code, true);
    }
  }

  function confirmDeactivate() {
    if (confirmParty) {
      setStatus(confirmParty.id, "inactive");
      void persistStatus(confirmParty.code, false);
    }
    setConfirmParty(null);
  }

  // Add/edit form state.
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<PartyForm>(EMPTY_FORM);
  const setField = <K extends keyof PartyForm>(k: K, v: PartyForm[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  function openAdd() {
    setEditId(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  }

  function openEdit(p: CustomerVendor) {
    setEditId(p.id);
    setForm({
      name: p.name,
      code: p.code,
      type: p.type,
      category: p.category,
      contactPerson: p.contactPerson,
      phone: p.phone,
      email: p.email,
      city: p.city,
      npwp: p.npwp,
      address: p.address,
      status: p.status,
    });
    setFormOpen(true);
  }

  const formValid = form.name.trim().length > 0 && form.code.trim().length > 0;

  async function saveForm() {
    if (!formValid) return;
    if (editId) {
      setOverrides((prev) => ({ ...prev, [editId]: { ...form } }));
    } else {
      const party: CustomerVendor = {
        ...form,
        name: form.name.trim(),
        code: form.code.trim(),
        id: `party-custom-${Date.now()}`,
        createdAt: new Date().toISOString().slice(0, 10),
      };
      setCustomParties((prev) => [party, ...prev]);
    }
    setFormOpen(false);

    // Persist (upsert by code) to the database.
    try {
      const res = await fetch("/api/master-customer-vendor", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...personaHeaders(persona.id) },
        body: JSON.stringify({
          code: form.code.trim(),
          name: form.name.trim(),
          type: form.type,
          category: form.category,
          contactPerson: form.contactPerson,
          phone: form.phone,
          email: form.email,
          city: form.city,
          npwp: form.npwp,
          address: form.address,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { source?: string; error?: string };
      if (res.ok && data.source === "db") {
        setSaveNote("Tersimpan ke database ✓");
        setCustomParties([]);
        setOverrides({});
        await loadParties();
      } else if (res.ok) {
        setSaveNote("Tersimpan di sesi ini (database tidak tersedia).");
      } else {
        setSaveNote(data.error ?? "Gagal menyimpan.");
      }
    } catch {
      setSaveNote("Tersimpan di sesi ini (jaringan bermasalah).");
    }
  }

  // Persist an active/inactive change (PATCH by code) to the database.
  async function persistStatus(code: string, active: boolean) {
    try {
      await fetch("/api/master-customer-vendor", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...personaHeaders(persona.id) },
        body: JSON.stringify({ code, active }),
      });
      await loadParties();
    } catch {
      /* keep optimistic status */
    }
  }

  const stats = useMemo(() => {
    const customers = all.filter((p) => p.type === "customer").length;
    const vendors = all.filter((p) => p.type === "vendor").length;
    const active = all.filter((p) => p.status === "active").length;
    return { total: all.length, customers, vendors, active };
  }, [all]);

  const parties = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter(
      (p) =>
        (typeFilter === "all" || p.type === typeFilter) &&
        (statusFilter === "all" || p.status === statusFilter) &&
        (!q ||
          p.name.toLowerCase().includes(q) ||
          p.code.toLowerCase().includes(q) ||
          p.contactPerson.toLowerCase().includes(q) ||
          p.city.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q)),
    );
  }, [all, query, typeFilter, statusFilter]);

  return (
    <div>
      <PageHeader
        title="Customer & Vendor"
        description="Direktori customer (klien) dan vendor (supplier) — Master Data."
        breadcrumbs={[{ label: "Master Data" }, { label: "Customer & Vendor" }]}
      />

      <div className="space-y-6 p-4 md:p-6">
        <PersonaBanner persona={persona} scopeSummary={`${stats.total} entitas`} />
        {saveNote && (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {saveNote}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Total", value: stats.total, icon: Contact },
            { label: "Customer", value: stats.customers, icon: Building2 },
            { label: "Vendor", value: stats.vendors, icon: Truck },
            { label: "Aktif", value: stats.active, icon: Contact },
          ].map((tile) => {
            const Icon = tile.icon;
            return (
              <Card key={tile.label}>
                <CardContent className="flex items-center justify-between py-4">
                  <div>
                    <div className="text-2xl font-semibold tabular-nums">{tile.value}</div>
                    <div className="text-xs text-muted-foreground">{tile.label}</div>
                  </div>
                  <Icon className="h-5 w-5 text-muted-foreground" />
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari nama, kode, kontak, kota…"
              className="h-8 w-64 pl-8 text-xs"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as PartyType | "all")}
            className="h-8 rounded-md border bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="all">Semua tipe</option>
            <option value="customer">Customer</option>
            <option value="vendor">Vendor</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as PartyStatus | "all")}
            className="h-8 rounded-md border bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="all">Semua status</option>
            <option value="active">Aktif</option>
            <option value="inactive">Nonaktif</option>
          </select>
          <Badge variant="default" className="ml-auto">
            {parties.length} hasil
          </Badge>
          {editable && (
            <Button size="sm" onClick={openAdd} className="gap-1.5">
              <Plus className="h-4 w-4" />
              Tambah
            </Button>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Contact className="h-4 w-4 text-primary" />
              Daftar Customer & Vendor
            </CardTitle>
            <CardDescription>Data mitra bisnis beserta kontak dan status.</CardDescription>
          </CardHeader>
          <CardContent>
            {parties.length === 0 ? (
              <div className="rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">
                Tidak ada data yang cocok dengan pencarian/filter.
              </div>
            ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Nama</th>
                    <th className="px-3 py-2 font-medium">Tipe</th>
                    <th className="px-3 py-2 font-medium">Kategori</th>
                    <th className="px-3 py-2 font-medium">Kontak</th>
                    <th className="px-3 py-2 font-medium">Kota</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    {editable && <th className="px-3 py-2 text-right font-medium">Aksi</th>}
                  </tr>
                </thead>
                <tbody>
                  {parties.map((p) => {
                    const typeMeta = PARTY_TYPE_META[p.type];
                    const statusMeta = PARTY_STATUS_META[p.status];
                    return (
                      <tr key={p.id} className="border-b last:border-b-0 align-top">
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setDetailParty(p)}
                              className="text-left font-medium text-primary hover:underline"
                            >
                              {p.name}
                            </button>
                            {p.id.startsWith("party-custom-") && <Badge variant="success">Kustom</Badge>}
                            {isEdited(p.id) && <Badge variant="warning">Diubah</Badge>}
                          </div>
                          <div className="font-mono text-[11px] text-muted-foreground">{p.code}</div>
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant={typeMeta.variant}>{typeMeta.label}</Badge>
                        </td>
                        <td className="px-3 py-2 text-xs">{p.category}</td>
                        <td className="px-3 py-2">
                          <div className="text-xs">{p.contactPerson}</div>
                          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            {p.phone}
                          </div>
                          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            <Mail className="h-3 w-3" />
                            {p.email}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <span className="flex items-center gap-1 text-xs">
                            <MapPin className="h-3 w-3 text-muted-foreground" />
                            {p.city}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
                        </td>
                        {editable && (
                          <td className="px-3 py-2 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEdit(p)}
                                className="h-7 gap-1 px-2"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                                Ubah
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => requestToggle(p)}
                                className={`h-7 gap-1 px-2 ${p.status === "active" ? "text-rose-600" : "text-emerald-600"}`}
                              >
                                {p.status === "active" ? (
                                  <>
                                    <Ban className="h-3.5 w-3.5" />
                                    Nonaktifkan
                                  </>
                                ) : (
                                  <>
                                    <RotateCcw className="h-3.5 w-3.5" />
                                    Aktifkan
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
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Pratinjau Pemilih (Reusable)</CardTitle>
            <CardDescription>
              Komponen pemilih ini hanya menampilkan data aktif — dipakai ulang di form invoice/pembelian.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid max-w-md gap-3">
              <CustomerVendorSelect
                label="Pilih Customer"
                type="customer"
                value={previewId}
                onChange={setPreviewId}
              />
              <CustomerVendorSelect
                label="Pilih Vendor"
                type="vendor"
                value={previewId}
                onChange={setPreviewId}
              />
            </div>
            {previewParty && (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                <Badge variant={PARTY_TYPE_META[previewParty.type].variant}>
                  {PARTY_TYPE_META[previewParty.type].label}
                </Badge>
                <span className="font-medium">{previewParty.name}</span>
                <span className="text-muted-foreground">· {previewParty.city}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editId ? "Ubah Customer/Vendor" : "Tambah Customer/Vendor"}
        description="Lengkapi data mitra bisnis. Nama dan kode wajib diisi."
        className="max-w-2xl"
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
        <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <Field label="Nama *">
            <Input value={form.name} onChange={(e) => setField("name", e.target.value)} className="h-9" placeholder="Nama entitas" />
          </Field>
          <Field label="Kode *">
            <Input value={form.code} onChange={(e) => setField("code", e.target.value)} className="h-9" placeholder="mis. CUST-XXX" />
          </Field>
          <Field label="Tipe">
            <select
              value={form.type}
              onChange={(e) => setField("type", e.target.value as PartyType)}
              className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="customer">Customer</option>
              <option value="vendor">Vendor</option>
            </select>
          </Field>
          <Field label="Status">
            <select
              value={form.status}
              onChange={(e) => setField("status", e.target.value as PartyStatus)}
              className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="active">Aktif</option>
              <option value="inactive">Nonaktif</option>
            </select>
          </Field>
          <Field label="Kategori">
            <Input value={form.category} onChange={(e) => setField("category", e.target.value)} className="h-9" placeholder="mis. Supplier Bahan Pangan" />
          </Field>
          <Field label="Kontak (PIC)">
            <Input value={form.contactPerson} onChange={(e) => setField("contactPerson", e.target.value)} className="h-9" />
          </Field>
          <Field label="Telepon">
            <Input value={form.phone} onChange={(e) => setField("phone", e.target.value)} className="h-9" />
          </Field>
          <Field label="Email">
            <Input type="email" value={form.email} onChange={(e) => setField("email", e.target.value)} className="h-9" />
          </Field>
          <Field label="Kota">
            <Input value={form.city} onChange={(e) => setField("city", e.target.value)} className="h-9" />
          </Field>
          <Field label="NPWP">
            <Input value={form.npwp} onChange={(e) => setField("npwp", e.target.value)} className="h-9" />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Alamat">
              <Input value={form.address} onChange={(e) => setField("address", e.target.value)} className="h-9" />
            </Field>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={detailParty !== null}
        onClose={() => setDetailParty(null)}
        title={detailParty?.name}
        description={
          detailParty
            ? `${PARTY_TYPE_META[detailParty.type].label} · ${detailParty.code}`
            : undefined
        }
        className="max-w-lg"
      >
        {detailParty && (
          <div className="space-y-3 text-sm">
            <div className="flex flex-wrap gap-2">
              <Badge variant={PARTY_TYPE_META[detailParty.type].variant}>
                {PARTY_TYPE_META[detailParty.type].label}
              </Badge>
              <Badge variant={PARTY_STATUS_META[detailParty.status].variant}>
                {PARTY_STATUS_META[detailParty.status].label}
              </Badge>
              <Badge variant="muted">{detailParty.category}</Badge>
            </div>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
              <DetailRow icon={Contact} label="Kontak (PIC)" value={detailParty.contactPerson} />
              <DetailRow icon={Phone} label="Telepon" value={detailParty.phone} />
              <DetailRow icon={Mail} label="Email" value={detailParty.email} />
              <DetailRow icon={MapPin} label="Kota" value={detailParty.city} />
              <DetailRow label="NPWP" value={detailParty.npwp} />
              <DetailRow label="Terdaftar" value={detailParty.createdAt} />
              <div className="sm:col-span-2">
                <DetailRow icon={MapPin} label="Alamat" value={detailParty.address} />
              </div>
            </dl>
          </div>
        )}
      </Dialog>

      <Dialog
        open={confirmParty !== null}
        onClose={() => setConfirmParty(null)}
        title="Nonaktifkan Data?"
        description={
          confirmParty
            ? `"${confirmParty.name}" tidak akan tersedia untuk dipilih pada transaksi baru sampai diaktifkan kembali.`
            : undefined
        }
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setConfirmParty(null)}>
              Batal
            </Button>
            <Button variant="destructive" size="sm" onClick={confirmDeactivate}>
              Nonaktifkan
            </Button>
          </div>
        }
      >
        <p className="text-sm text-muted-foreground">
          Data historis yang sudah memakai mitra ini tidak berubah. Anda dapat mengaktifkannya lagi kapan
          saja.
        </p>
      </Dialog>
    </div>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon?: typeof Contact;
  label: string;
  value: string;
}) {
  return (
    <div>
      <dt className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-muted-foreground">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </dt>
      <dd className="mt-0.5 text-sm">{value || "—"}</dd>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
