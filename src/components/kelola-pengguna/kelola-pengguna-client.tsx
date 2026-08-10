"use client";

import { useMemo, useState } from "react";
import { Users, MapPin, Shield, Search, Mail, UserPlus, Check, Minus } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { usePersona } from "@/components/providers/persona-provider";
import { type Persona, type PersonaRole } from "@/lib/personas";
import { formatDate } from "@/lib/utils";
import { SESSION_KEY } from "@/lib/auth";
import { MOCK_WORKSPACES } from "@/lib/mock/workspaces";
import {
  listManagedUsers,
  listRoles,
  getRoleDefinition,
  describeSiteAccess,
  countAccessibleSites,
  roleCan,
  rbacModules,
  rbacActions,
  RBAC_MODULE_LABEL,
  RBAC_ACTION_LABEL,
  USER_STATUS_META,
  type ManagedUser,
  type SiteGrant,
} from "@/lib/mock/rbac";

/** Only super/leader admins may manage users. */
function canManageUsers(persona: Persona): boolean {
  return persona.role === "super_admin" || persona.role === "leader_admin";
}

const ROLE_BADGE: Record<PersonaRole, "danger" | "info" | "success" | "muted"> = {
  super_admin: "danger",
  leader_admin: "info",
  site_admin: "success",
  viewer: "muted",
};

/** Build a user's currently-granted location id set (org-wide → all sites). */
function grantedLocationIds(user: ManagedUser): string[] {
  if (user.siteAccess.length === 0) return MOCK_WORKSPACES.map((w) => w.locationId);
  const set = new Set<string>();
  for (const g of user.siteAccess) {
    if (g.locations.length === 0) {
      MOCK_WORKSPACES.filter((w) => w.projectCode === g.projectCode).forEach((w) => set.add(w.locationId));
    } else {
      g.locations.forEach((l) => set.add(l));
    }
  }
  return [...set];
}

/** Convert a flat set of location ids into grouped SiteGrant[]. */
function locationsToGrants(locationIds: string[]): SiteGrant[] {
  const byProject = new Map<string, string[]>();
  for (const id of locationIds) {
    const w = MOCK_WORKSPACES.find((x) => x.locationId === id);
    if (!w) continue;
    const arr = byProject.get(w.projectCode) ?? [];
    arr.push(id);
    byProject.set(w.projectCode, arr);
  }
  return [...byProject].map(([projectCode, locations]) => {
    const totalInProject = MOCK_WORKSPACES.filter((w) => w.projectCode === projectCode).length;
    // All sites of a project selected → collapse to a project-wide grant.
    return { projectCode, locations: locations.length === totalInProject ? [] : locations };
  });
}

/**
 * Kelola Pengguna — user management with location assignment (config-driven from
 * the RBAC mock). Lists managed users with their role and multi-site mapping;
 * admins can reassign which sites a user may reach. Session-local edits until the
 * users API lands. Persona-gated: only super/leader admins manage users.
 */
export function KelolaPenggunaClient() {
  const { persona, personas, setPersonaId } = usePersona();
  const manage = canManageUsers(persona);

  function switchSession(id: string) {
    setPersonaId(id);
    if (typeof window !== "undefined") window.localStorage.setItem(SESSION_KEY, id);
  }

  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<PersonaRole | "all">("all");

  // Session-local overrides keyed by user id (site access + role) and new accounts.
  const [accessOverrides, setAccessOverrides] = useState<Record<string, SiteGrant[]>>({});
  const [roleOverrides, setRoleOverrides] = useState<Record<string, PersonaRole>>({});
  const [customUsers, setCustomUsers] = useState<ManagedUser[]>([]);

  const allUsers: ManagedUser[] = useMemo(
    () =>
      [...customUsers, ...listManagedUsers()].map((u) => ({
        ...u,
        role: roleOverrides[u.id] ?? u.role,
        siteAccess: accessOverrides[u.id] ?? u.siteAccess,
      })),
    [accessOverrides, roleOverrides, customUsers],
  );

  const users: ManagedUser[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allUsers.filter(
      (u) =>
        (roleFilter === "all" || u.role === roleFilter) &&
        (!q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)),
    );
  }, [allUsers, query, roleFilter]);

  const stats = useMemo(() => {
    const s = { total: allUsers.length, active: 0, invited: 0, suspended: 0 };
    for (const u of allUsers) s[u.status]++;
    return s;
  }, [allUsers]);

  // Role & location modal state.
  const [assignUser, setAssignUser] = useState<ManagedUser | null>(null);
  const [assignRole, setAssignRole] = useState<PersonaRole>("site_admin");
  const [selectedLocs, setSelectedLocs] = useState<string[]>([]);

  function openAssign(u: ManagedUser) {
    setAssignUser(u);
    setAssignRole(u.role);
    setSelectedLocs(grantedLocationIds(u));
  }

  function toggleLoc(id: string) {
    setSelectedLocs((prev) => (prev.includes(id) ? prev.filter((l) => l !== id) : [...prev, id]));
  }

  function saveAssign() {
    if (!assignUser) return;
    setRoleOverrides((prev) => ({ ...prev, [assignUser.id]: assignRole }));
    // Org-wide roles get full access; scoped roles keep the picked sites.
    setAccessOverrides((prev) => ({
      ...prev,
      [assignUser.id]: assignRole === "super_admin" ? [] : locationsToGrants(selectedLocs),
    }));
    setAssignUser(null);
  }

  // Create-account modal state.
  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addRole, setAddRole] = useState<PersonaRole>("site_admin");
  const [addLocs, setAddLocs] = useState<string[]>([]);

  function openAdd() {
    setAddName("");
    setAddEmail("");
    setAddRole("site_admin");
    setAddLocs([]);
    setAddOpen(true);
  }

  const addValid = addName.trim().length > 0 && /.+@.+\..+/.test(addEmail.trim());

  function saveAdd() {
    if (!addValid) return;
    // Org-wide roles get full access; scoped roles use the picked sites.
    const orgWide = addRole === "super_admin";
    const user: ManagedUser = {
      id: `usr-custom-${Date.now()}`,
      name: addName.trim(),
      email: addEmail.trim(),
      role: addRole,
      status: "invited",
      siteAccess: orgWide ? [] : locationsToGrants(addLocs),
      createdAt: new Date().toISOString().slice(0, 10),
    };
    setCustomUsers((prev) => [user, ...prev]);
    setAddOpen(false);
  }

  return (
    <div>
      <PageHeader
        title="Kelola Pengguna"
        description="Manajemen akun, peran, dan penugasan lokasi (RBAC multi-site)."
        breadcrumbs={[{ label: "Master Data" }, { label: "Kelola Pengguna" }]}
      />

      <div className="space-y-6 p-4 md:p-6">
        <PersonaBanner persona={persona} scopeSummary={`${stats.total} pengguna`} />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4 text-primary" />
              Sesi Aktif
            </CardTitle>
            <CardDescription>
              Beralih sesi antar akun tanpa logout. Sesi saat ini:{" "}
              <span className="font-medium text-foreground">{persona.name}</span> ({persona.roleLabel}).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {personas.map((p) => {
                const active = p.id === persona.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => switchSession(p.id)}
                    className={
                      "flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition " +
                      (active ? "border-primary bg-primary/5" : "hover:bg-accent")
                    }
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                      {p.initials}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{p.name}</div>
                      <div className="truncate text-[11px] text-muted-foreground">{p.roleLabel}</div>
                    </div>
                    {active && <Check className="h-4 w-4 text-primary" />}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Total Pengguna", value: stats.total, variant: "default" as const },
            { label: "Aktif", value: stats.active, variant: "success" as const },
            { label: "Diundang", value: stats.invited, variant: "warning" as const },
            { label: "Ditangguhkan", value: stats.suspended, variant: "danger" as const },
          ].map((tile) => (
            <Card key={tile.label}>
              <CardContent className="flex items-center justify-between py-4">
                <div>
                  <div className="text-2xl font-semibold tabular-nums">{tile.value}</div>
                  <div className="text-xs text-muted-foreground">{tile.label}</div>
                </div>
                <Badge variant={tile.variant} className="h-2 w-2 rounded-full p-0" />
              </CardContent>
            </Card>
          ))}
        </div>

        {!manage && (
          <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Anda hanya dapat melihat daftar pengguna. Pengelolaan akun & penugasan lokasi butuh peran
            Leader/Super Admin.
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari nama / email…"
              className="h-8 w-56 pl-8 text-xs"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as PersonaRole | "all")}
            className="h-8 rounded-md border bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="all">Semua peran</option>
            {listRoles().map((r) => (
              <option key={r.role} value={r.role}>
                {r.label}
              </option>
            ))}
          </select>
          {manage && (
            <Button size="sm" onClick={openAdd} className="ml-auto gap-1.5">
              <UserPlus className="h-4 w-4" />
              Tambah Akun
            </Button>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Daftar Pengguna
            </CardTitle>
            <CardDescription>Akun beserta peran dan cakupan site yang ditugaskan.</CardDescription>
          </CardHeader>
          <CardContent>
            {users.length === 0 ? (
              <div className="rounded-md border border-dashed py-6 text-center text-sm text-muted-foreground">
                Tidak ada pengguna yang cocok.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="px-3 py-2 font-medium">Pengguna</th>
                      <th className="px-3 py-2 font-medium">Peran</th>
                      <th className="px-3 py-2 font-medium">Penugasan Lokasi</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 font-medium">Bergabung</th>
                      {manage && <th className="px-3 py-2 text-right font-medium">Aksi</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => {
                      const role = getRoleDefinition(u.role);
                      const status = USER_STATUS_META[u.status];
                      return (
                        <tr key={u.id} className="border-b last:border-b-0 align-top">
                          <td className="px-3 py-2">
                            <div className="font-medium">{u.name}</div>
                            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                              <Mail className="h-3 w-3" />
                              {u.email}
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <Badge variant={ROLE_BADGE[u.role]} className="gap-1">
                              <Shield className="h-3 w-3" />
                              {role.label}
                            </Badge>
                          </td>
                          <td className="px-3 py-2">
                            <div className="text-xs">{describeSiteAccess(u)}</div>
                            <div className="text-[11px] text-muted-foreground">
                              {countAccessibleSites(u)} site
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <Badge variant={status.variant}>{status.label}</Badge>
                          </td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">
                            {formatDate(u.createdAt)}
                          </td>
                          {manage && (
                            <td className="px-3 py-2 text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openAssign(u)}
                                className="h-7 gap-1 px-2"
                              >
                                <Shield className="h-3.5 w-3.5" />
                                Peran &amp; Lokasi
                              </Button>
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
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              Matriks Peran &amp; Izin
            </CardTitle>
            <CardDescription>
              Izin per modul untuk setiap peran (RBAC). Site Admin dibatasi pada operasional sitenya.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-xs">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="px-2 py-2 font-medium">Modul</th>
                    {listRoles().map((r) => (
                      <th key={r.role} className="px-2 py-2 text-center font-medium">
                        {r.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rbacModules().map((m) => (
                    <tr key={m} className="border-b last:border-b-0">
                      <td className="px-2 py-2 font-medium">{RBAC_MODULE_LABEL[m]}</td>
                      {listRoles().map((r) => {
                        const allowed = rbacActions().filter((a) => roleCan(r.role, m, a));
                        return (
                          <td key={r.role} className="px-2 py-2 text-center">
                            {allowed.length === 0 ? (
                              <Minus className="mx-auto h-3.5 w-3.5 text-muted-foreground/50" />
                            ) : (
                              <span
                                className="inline-flex items-center gap-1 text-emerald-700"
                                title={allowed.map((a) => RBAC_ACTION_LABEL[a]).join(", ")}
                              >
                                <Check className="h-3.5 w-3.5" />
                                {allowed.length}
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Angka = jumlah aksi yang diizinkan (arahkan kursor untuk detail). — = tanpa akses.
            </p>
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={assignUser !== null}
        onClose={() => setAssignUser(null)}
        title="Peran & Lokasi"
        description={assignUser ? `Atur peran dan cakupan site untuk ${assignUser.name}.` : undefined}
        className="max-w-lg"
        footer={
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">
              {assignRole === "super_admin" ? "Akses penuh" : `${selectedLocs.length} site dipilih`}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setAssignUser(null)}>
                Batal
              </Button>
              <Button
                size="sm"
                onClick={saveAssign}
                disabled={assignRole !== "super_admin" && selectedLocs.length === 0}
              >
                Simpan
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-3 text-sm">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Peran</label>
            <select
              value={assignRole}
              onChange={(e) => setAssignRole(e.target.value as PersonaRole)}
              className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              {listRoles().map((r) => (
                <option key={r.role} value={r.role}>
                  {r.label}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-muted-foreground">{getRoleDefinition(assignRole).description}</p>
          </div>

          {assignRole === "super_admin" ? (
            <div className="rounded-md border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
              Super Admin memiliki akses ke semua project & site secara otomatis.
            </div>
          ) : (
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Penugasan Lokasi</label>
              <div className="max-h-56 space-y-1 overflow-y-auto rounded-md border p-1">
                {MOCK_WORKSPACES.map((w) => {
                  const checked = selectedLocs.includes(w.locationId);
                  return (
                    <label
                      key={w.locationId}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleLoc(w.locationId)}
                        className="h-4 w-4 rounded border-input"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{w.locationName}</div>
                        <div className="truncate text-[11px] text-muted-foreground">
                          {w.projectName} · {w.projectCode}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </Dialog>

      <Dialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Tambah Akun"
        description="Buat akun baru dan tetapkan peran serta cakupan site."
        className="max-w-lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setAddOpen(false)}>
              Batal
            </Button>
            <Button size="sm" onClick={saveAdd} disabled={!addValid}>
              Simpan
            </Button>
          </div>
        }
      >
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Nama</label>
              <Input value={addName} onChange={(e) => setAddName(e.target.value)} placeholder="Nama lengkap" className="h-9" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Email</label>
              <Input
                type="email"
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
                placeholder="nama@tpb.co.id"
                className="h-9"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Peran</label>
            <select
              value={addRole}
              onChange={(e) => setAddRole(e.target.value as PersonaRole)}
              className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              {listRoles().map((r) => (
                <option key={r.role} value={r.role}>
                  {r.label}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-muted-foreground">{getRoleDefinition(addRole).description}</p>
          </div>
          {addRole !== "super_admin" && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Penugasan Lokasi ({addLocs.length} dipilih)
              </label>
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-1">
                {MOCK_WORKSPACES.map((w) => (
                  <label
                    key={w.locationId}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 hover:bg-accent"
                  >
                    <input
                      type="checkbox"
                      checked={addLocs.includes(w.locationId)}
                      onChange={() =>
                        setAddLocs((prev) =>
                          prev.includes(w.locationId)
                            ? prev.filter((l) => l !== w.locationId)
                            : [...prev, w.locationId],
                        )
                      }
                      className="h-4 w-4 rounded border-input"
                    />
                    <span className="truncate text-xs">
                      {w.locationName}
                      <span className="text-muted-foreground"> · {w.projectCode}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      </Dialog>
    </div>
  );
}
