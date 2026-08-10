"use client";

import { useMemo, useState } from "react";
import { Users, MapPin, Shield, Search, Pencil, Mail } from "lucide-react";
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
import { MOCK_WORKSPACES } from "@/lib/mock/workspaces";
import {
  listManagedUsers,
  listRoles,
  getRoleDefinition,
  describeSiteAccess,
  countAccessibleSites,
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
  const { persona } = usePersona();
  const manage = canManageUsers(persona);

  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<PersonaRole | "all">("all");

  // Session-local site-access overrides keyed by user id.
  const [accessOverrides, setAccessOverrides] = useState<Record<string, SiteGrant[]>>({});

  const allUsers: ManagedUser[] = useMemo(
    () =>
      listManagedUsers().map((u) =>
        accessOverrides[u.id] ? { ...u, siteAccess: accessOverrides[u.id] } : u,
      ),
    [accessOverrides],
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

  // Location-assignment modal state.
  const [assignUser, setAssignUser] = useState<ManagedUser | null>(null);
  const [selectedLocs, setSelectedLocs] = useState<string[]>([]);

  function openAssign(u: ManagedUser) {
    setAssignUser(u);
    setSelectedLocs(grantedLocationIds(u));
  }

  function toggleLoc(id: string) {
    setSelectedLocs((prev) => (prev.includes(id) ? prev.filter((l) => l !== id) : [...prev, id]));
  }

  function saveAssign() {
    if (!assignUser) return;
    setAccessOverrides((prev) => ({ ...prev, [assignUser.id]: locationsToGrants(selectedLocs) }));
    setAssignUser(null);
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
                                disabled={u.role === "super_admin"}
                                className="h-7 gap-1 px-2"
                                title={
                                  u.role === "super_admin"
                                    ? "Super Admin selalu punya akses penuh"
                                    : undefined
                                }
                              >
                                <MapPin className="h-3.5 w-3.5" />
                                Penugasan
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
      </div>

      <Dialog
        open={assignUser !== null}
        onClose={() => setAssignUser(null)}
        title="Penugasan Lokasi"
        description={
          assignUser
            ? `Pilih site yang dapat diakses oleh ${assignUser.name} (${getRoleDefinition(assignUser.role).label}).`
            : undefined
        }
        className="max-w-lg"
        footer={
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">{selectedLocs.length} site dipilih</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setAssignUser(null)}>
                Batal
              </Button>
              <Button size="sm" onClick={saveAssign} disabled={selectedLocs.length === 0}>
                Simpan
              </Button>
            </div>
          </div>
        }
      >
        <div className="max-h-72 space-y-1 overflow-y-auto text-sm">
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
      </Dialog>
    </div>
  );
}
