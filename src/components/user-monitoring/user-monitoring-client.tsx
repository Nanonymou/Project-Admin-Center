"use client";

import { useMemo, useState } from "react";
import { HardDrive, Info, MapPin, Search, UploadCloud, Users } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { KpiCard } from "@/components/common/kpi-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePersona } from "@/components/providers/persona-provider";
import {
  buildUsers,
  buildStorageByProject,
  USER_ROLE_LABEL,
  USER_STATUS_META,
  type UserStatus,
} from "@/lib/mock/user-monitoring";
import { cn, formatNumber } from "@/lib/utils";

export function UserMonitoringClient() {
  const { persona } = usePersona();
  const users = useMemo(() => buildUsers(), []);
  const [statusFilter, setStatusFilter] = useState<UserStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [scopeFilter, setScopeFilter] = useState("all");

  const scopes = useMemo(() => Array.from(new Set(users.map((u) => u.scope))).sort(), [users]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (statusFilter !== "all" && u.status !== statusFilter) return false;
      if (scopeFilter !== "all" && u.scope !== scopeFilter) return false;
      if (q && !u.name.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q) && !u.scope.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [users, statusFilter, scopeFilter, search]);

  const stats = useMemo(
    () => ({
      total: users.length,
      active: users.filter((u) => u.status === "active").length,
      storageMb: users.reduce((s, u) => s + u.storageMb, 0),
      uploads: users.reduce((s, u) => s + u.uploads, 0),
    }),
    [users],
  );

  const maxStorage = Math.max(1, ...users.map((u) => u.storageMb));
  const projectStorage = useMemo(() => buildStorageByProject(), []);

  return (
    <div>
      <PageHeader
        title="User & Storage Monitoring"
        description="Pantau aktivitas user, sesi aktif, dan penggunaan penyimpanan lampiran."
        breadcrumbs={[{ label: "Master Data" }, { label: "User & Storage" }]}
      />

      <div className="space-y-6 p-4 md:p-6">
        <PersonaBanner persona={persona} scopeSummary={`${stats.total} user terpantau`} />

        <div className="flex items-start gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>Data user & storage bersifat mock. Storage dihitung dari total lampiran yang diunggah user.</span>
        </div>

        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiCard label="Total User" value={stats.total} format="number" icon={Users} tone="primary" />
          <KpiCard label="Aktif Sekarang" value={stats.active} format="number" icon={Users} tone="success" />
          <KpiCard label="Total Storage" value={`${formatNumber(Math.round(stats.storageMb))} MB`} format="text" icon={HardDrive} tone="info" />
          <KpiCard label="Total Upload" value={stats.uploads} format="number" icon={UploadCloud} tone="warning" />
        </section>

        <Card>
          <CardHeader>
            <CardTitle>Storage per Project</CardTitle>
            <CardDescription>Penggunaan penyimpanan lampiran terhadap kuota tiap project.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {projectStorage.map((p) => {
                const pct = (p.usedMb / p.quotaMb) * 100;
                const tone = pct >= 85 ? "bg-rose-500" : pct >= 65 ? "bg-amber-500" : "bg-emerald-500";
                return (
                  <div key={p.code} className="rounded-md border p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{p.code}</span>
                      <span className="text-[11px] text-muted-foreground">{p.files} file</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                      <div className={cn("h-full rounded-full", tone)} style={{ width: `${Math.min(100, pct)}%` }} />
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[11px] tabular-nums text-muted-foreground">
                      <span>{formatNumber(Math.round(p.usedMb))} / {formatNumber(p.quotaMb)} MB</span>
                      <span className={cn(pct >= 85 && "text-rose-600 font-medium")}>{pct.toFixed(0)}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle>Daftar User</CardTitle>
              <CardDescription>Status aktivitas, sesi, dan penggunaan storage per user.</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari user…"
                  className="h-7 w-40 rounded-md border bg-background pl-7 pr-2 text-[11px] outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="relative">
                <MapPin className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <select
                  value={scopeFilter}
                  onChange={(e) => setScopeFilter(e.target.value)}
                  className="h-7 rounded-md border bg-background pl-7 pr-2 text-[11px] outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="all">Semua lokasi</option>
                  {scopes.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              {(["all", "active", "idle", "offline"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(s)}
                  className={cn(
                    "rounded-md border px-2 py-1 text-[11px] font-medium",
                    statusFilter === s
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-background hover:bg-accent",
                  )}
                >
                  {s === "all" ? "Semua" : USER_STATUS_META[s].label}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2 text-left font-medium">User</th>
                    <th className="px-3 py-2 text-left font-medium">Role</th>
                    <th className="px-3 py-2 text-left font-medium">Scope</th>
                    <th className="px-3 py-2 text-left font-medium">Status</th>
                    <th className="px-3 py-2 text-right font-medium">Sesi</th>
                    <th className="px-3 py-2 text-left font-medium">Storage</th>
                    <th className="px-3 py-2 text-left font-medium">Aktif Terakhir</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((u) => {
                    const meta = USER_STATUS_META[u.status];
                    return (
                      <tr key={u.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-3 py-2">
                          <div className="font-medium">{u.name}</div>
                          <div className="text-[11px] text-muted-foreground">{u.email}</div>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{USER_ROLE_LABEL[u.role]}</td>
                        <td className="px-3 py-2 text-muted-foreground">{u.scope}</td>
                        <td className="px-3 py-2">
                          <Badge variant={meta.variant}>{meta.label}</Badge>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{u.sessions}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                              <div className="h-full rounded-full bg-primary" style={{ width: `${(u.storageMb / maxStorage) * 100}%` }} />
                            </div>
                            <span className="text-[11px] tabular-nums text-muted-foreground">{u.storageMb} MB</span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{u.lastActive}</td>
                      </tr>
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
