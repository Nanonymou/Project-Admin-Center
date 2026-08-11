"use client";

import { useMemo, useState } from "react";
import { Contact, Building2, Truck, Mail, Phone, MapPin, Search } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { usePersona } from "@/components/providers/persona-provider";
import {
  listCustomerVendors,
  PARTY_TYPE_META,
  PARTY_STATUS_META,
  type PartyStatus,
  type PartyType,
} from "@/lib/mock/customer-vendor";

/**
 * Master Customer & Vendor — the org-level directory of clients (customers) and
 * suppliers (vendors), config-driven. Read-only list here; search/filter, add/
 * edit, detail, deactivate, and a reusable picker are layered on by later tasks.
 */
export function CustomerVendorClient() {
  const { persona } = usePersona();
  const all = listCustomerVendors();

  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<PartyType | "all">("all");
  const [statusFilter, setStatusFilter] = useState<PartyStatus | "all">("all");

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
                  </tr>
                </thead>
                <tbody>
                  {parties.map((p) => {
                    const typeMeta = PARTY_TYPE_META[p.type];
                    const statusMeta = PARTY_STATUS_META[p.status];
                    return (
                      <tr key={p.id} className="border-b last:border-b-0 align-top">
                        <td className="px-3 py-2">
                          <div className="font-medium">{p.name}</div>
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
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
