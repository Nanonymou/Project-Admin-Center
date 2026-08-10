"use client";

import { useMemo, useState } from "react";
import { Shield, Users, ChevronDown, ChevronRight, Check, Minus, Plus, Pencil } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { usePersona } from "@/components/providers/persona-provider";
import {
  listRoles,
  listManagedUsers,
  rbacModules,
  rbacActions,
  RBAC_MODULE_LABEL,
  RBAC_ACTION_LABEL,
  type RoleDefinition,
  type RbacModule,
  type RbacAction,
} from "@/lib/mock/rbac";

/** A role row that may be a built-in or a session-local custom role. */
type EditableRole = Omit<RoleDefinition, "role"> & { role: string; custom?: boolean };

const ROLE_BADGE: Record<string, "danger" | "info" | "success" | "muted"> = {
  super_admin: "danger",
  leader_admin: "info",
  site_admin: "success",
  viewer: "muted",
};

const emptyPermissions = (): Record<RbacModule, RbacAction[]> => {
  const rec = {} as Record<RbacModule, RbacAction[]>;
  for (const m of rbacModules()) rec[m] = [];
  return rec;
};

/**
 * Role — the RBAC role catalogue (`rbac.ts`). Lists each role with its
 * description, holder count, and module-access footprint; rows expand to the
 * full permission matrix. Leaders/super admins can add custom roles
 * (session-local). Persona-scoped.
 */
export function RoleClient() {
  const { persona } = usePersona();
  const canManage = persona.role === "super_admin" || persona.role === "leader_admin";

  const [customRoles, setCustomRoles] = useState<EditableRole[]>([]);
  // Session-local field overrides for built-in roles, keyed by role key.
  const [overrides, setOverrides] = useState<
    Record<string, Pick<EditableRole, "label" | "description" | "permissions">>
  >({});

  const roles: EditableRole[] = useMemo(
    () => [...listRoles(), ...customRoles].map((r) => ({ ...r, ...(overrides[r.role] ?? {}) })),
    [customRoles, overrides],
  );
  const isEdited = (key: string) => key in overrides;

  const [expanded, setExpanded] = useState<string | null>(null);

  const usersByRole = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const u of listManagedUsers()) counts[u.role] = (counts[u.role] ?? 0) + 1;
    return counts;
  }, []);

  const modules = rbacModules();
  const actions = rbacActions();

  const moduleAccessCount = (role: EditableRole) =>
    modules.filter((m) => role.permissions[m].length > 0).length;

  // Add/edit-role form state. `editKey` = null → add; otherwise the role's key.
  const [formOpen, setFormOpen] = useState(false);
  const [editKey, setEditKey] = useState<string | null>(null);
  const [editCustom, setEditCustom] = useState(false);
  const [formLabel, setFormLabel] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formPerms, setFormPerms] = useState<Record<RbacModule, RbacAction[]>>(emptyPermissions());

  function openAdd() {
    setEditKey(null);
    setEditCustom(false);
    setFormLabel("");
    setFormDesc("");
    setFormPerms(emptyPermissions());
    setFormOpen(true);
  }

  function openEdit(role: EditableRole) {
    setEditKey(role.role);
    setEditCustom(Boolean(role.custom));
    setFormLabel(role.label);
    setFormDesc(role.description);
    // Clone the permission record so edits don't mutate the source.
    const perms = emptyPermissions();
    for (const m of modules) perms[m] = [...role.permissions[m]];
    setFormPerms(perms);
    setFormOpen(true);
  }

  function togglePerm(m: RbacModule, a: RbacAction) {
    setFormPerms((prev) => {
      const cur = prev[m];
      return { ...prev, [m]: cur.includes(a) ? cur.filter((x) => x !== a) : [...cur, a] };
    });
  }

  function saveForm() {
    const label = formLabel.trim();
    if (!label) return;
    const description = formDesc.trim() || "Role kustom.";
    if (editKey) {
      if (editCustom) {
        setCustomRoles((prev) =>
          prev.map((r) => (r.role === editKey ? { ...r, label, description, permissions: formPerms } : r)),
        );
      } else {
        setOverrides((prev) => ({ ...prev, [editKey]: { label, description, permissions: formPerms } }));
      }
    } else {
      const key = `custom_${label.toLowerCase().replace(/[^a-z0-9]+/g, "_")}_${Date.now()}`;
      setCustomRoles((prev) => [...prev, { role: key, label, description, permissions: formPerms, custom: true }]);
    }
    setFormOpen(false);
  }

  return (
    <div>
      <PageHeader
        title="Role"
        description="Katalog peran & hak akses (RBAC, config-driven)."
        breadcrumbs={[{ label: "Master Data" }, { label: "Role" }]}
      />

      <div className="space-y-6 p-4 md:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <PersonaBanner persona={persona} scopeSummary={`${roles.length} role`} />
          {canManage && (
            <Button size="sm" onClick={openAdd} className="ml-auto gap-1.5">
              <Plus className="h-4 w-4" />
              Tambah Role
            </Button>
          )}
        </div>

        <div className="space-y-4">
          {roles.map((role) => {
            const isOpen = expanded === role.role;
            return (
              <Card key={role.role}>
                <CardHeader
                  className="cursor-pointer"
                  onClick={() => setExpanded(isOpen ? null : role.role)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                        {isOpen ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                        <Shield className="h-4 w-4 text-primary" />
                        {role.label}
                        {role.custom && <Badge variant="success">Kustom</Badge>}
                        {!role.custom && isEdited(role.role) && <Badge variant="warning">Diubah</Badge>}
                        <Badge variant={ROLE_BADGE[role.role] ?? "muted"} className="font-mono text-[10px]">
                          {role.role}
                        </Badge>
                      </CardTitle>
                      <CardDescription className="mt-1">{role.description}</CardDescription>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <Badge variant="secondary" className="gap-1">
                        <Users className="h-3 w-3" />
                        {usersByRole[role.role] ?? 0} pengguna
                      </Badge>
                      <Badge variant="info">
                        {moduleAccessCount(role)}/{modules.length} modul
                      </Badge>
                      {canManage && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEdit(role);
                          }}
                          className="h-7 gap-1 px-2 text-xs"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Ubah
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                {isOpen && (
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[560px] text-xs">
                        <thead>
                          <tr className="border-b text-left text-muted-foreground">
                            <th className="px-2 py-2 font-medium">Modul</th>
                            {actions.map((a) => (
                              <th key={a} className="px-2 py-2 text-center font-medium">
                                {RBAC_ACTION_LABEL[a]}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {modules.map((m) => (
                            <tr key={m} className="border-b last:border-b-0">
                              <td className="px-2 py-2 font-medium">{RBAC_MODULE_LABEL[m]}</td>
                              {actions.map((a) => (
                                <td key={a} className="px-2 py-2 text-center">
                                  {role.permissions[m].includes(a) ? (
                                    <Check className="mx-auto h-3.5 w-3.5 text-emerald-600" />
                                  ) : (
                                    <Minus className="mx-auto h-3.5 w-3.5 text-muted-foreground/40" />
                                  )}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      </div>

      <Dialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editKey ? "Ubah Role" : "Tambah Role"}
        description="Tentukan nama, deskripsi, dan hak akses role per modul."
        className="max-w-2xl"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setFormOpen(false)}>
              Batal
            </Button>
            <Button size="sm" onClick={saveForm} disabled={!formLabel.trim()}>
              Simpan
            </Button>
          </div>
        }
      >
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Nama Role</label>
              <Input value={formLabel} onChange={(e) => setFormLabel(e.target.value)} placeholder="mis. Auditor" className="h-9" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Deskripsi</label>
              <Input value={formDesc} onChange={(e) => setFormDesc(e.target.value)} placeholder="Ringkas peran ini" className="h-9" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Hak Akses</label>
            <div className="max-h-72 overflow-auto rounded-md border">
              <table className="w-full min-w-[520px] text-xs">
                <thead className="sticky top-0 bg-muted/60">
                  <tr className="text-left text-muted-foreground">
                    <th className="px-2 py-2 font-medium">Modul</th>
                    {actions.map((a) => (
                      <th key={a} className="px-2 py-2 text-center font-medium">
                        {RBAC_ACTION_LABEL[a]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {modules.map((m) => (
                    <tr key={m} className="border-t">
                      <td className="px-2 py-1.5 font-medium">{RBAC_MODULE_LABEL[m]}</td>
                      {actions.map((a) => (
                        <td key={a} className="px-2 py-1.5 text-center">
                          <input
                            type="checkbox"
                            checked={formPerms[m].includes(a)}
                            onChange={() => togglePerm(m, a)}
                            className="h-3.5 w-3.5 rounded border-input"
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
