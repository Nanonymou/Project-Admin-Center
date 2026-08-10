"use client";

import { useMemo, useState } from "react";
import { Shield, Users, ChevronDown, ChevronRight, Check, Minus } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePersona } from "@/components/providers/persona-provider";
import {
  listRoles,
  listManagedUsers,
  roleCan,
  rbacModules,
  rbacActions,
  RBAC_MODULE_LABEL,
  RBAC_ACTION_LABEL,
  type RoleDefinition,
} from "@/lib/mock/rbac";

const ROLE_BADGE: Record<string, "danger" | "info" | "success" | "muted"> = {
  super_admin: "danger",
  leader_admin: "info",
  site_admin: "success",
  viewer: "muted",
};

/**
 * Role — the config-driven catalogue of RBAC roles (`rbac.ts`). Lists each role
 * with its description, how many users hold it, and its module-access footprint;
 * rows expand to the full permission matrix. Read-only here; add/edit/deactivate
 * are layered on by later tasks. Persona-scoped view.
 */
export function RoleClient() {
  const { persona } = usePersona();
  const roles = listRoles();
  const [expanded, setExpanded] = useState<string | null>(null);

  const usersByRole = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const u of listManagedUsers()) counts[u.role] = (counts[u.role] ?? 0) + 1;
    return counts;
  }, []);

  const modules = rbacModules();
  const actions = rbacActions();

  function moduleAccessCount(role: RoleDefinition): number {
    return modules.filter((m) => role.permissions[m].length > 0).length;
  }

  return (
    <div>
      <PageHeader
        title="Role"
        description="Katalog peran & hak akses (RBAC, config-driven)."
        breadcrumbs={[{ label: "Master Data" }, { label: "Role" }]}
      />

      <div className="space-y-6 p-4 md:p-6">
        <PersonaBanner persona={persona} scopeSummary={`${roles.length} role`} />

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
                      <CardTitle className="flex items-center gap-2 text-base">
                        {isOpen ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                        <Shield className="h-4 w-4 text-primary" />
                        {role.label}
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
                                  {roleCan(role.role, m, a) ? (
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
    </div>
  );
}
