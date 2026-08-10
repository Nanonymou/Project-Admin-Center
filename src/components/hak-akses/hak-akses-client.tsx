"use client";

import { useMemo, useState } from "react";
import { ShieldCheck, Menu as MenuIcon, Check, X, Download, GitBranch, Settings2, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePersona } from "@/components/providers/persona-provider";
import { PERSONAS, type PersonaRole } from "@/lib/personas";
import { filterNavForRole } from "@/lib/mock/access-config";

const ROLES: { role: PersonaRole; label: string }[] = [
  { role: "super_admin", label: "Super Admin" },
  { role: "leader_admin", label: "Leader Admin" },
  { role: "site_admin", label: "Site Admin" },
  { role: "viewer", label: "Viewer" },
];

const CAP_META: { key: keyof (typeof PERSONAS)[number]["capabilities"]; label: string; icon: typeof Download }[] = [
  { key: "canExport", label: "Ekspor Data", icon: Download },
  { key: "canApprove", label: "Approve", icon: Check },
  { key: "canConfigure", label: "Konfigurasi", icon: Settings2 },
  { key: "canSwitchWorkspace", label: "Pindah Workspace", icon: RefreshCw },
];

/**
 * Hak Akses — role-based access rights: the main layout preview with a menu that
 * changes dynamically per role. Selecting a role re-renders the visible nav
 * sections/items (from the shared access config) and the role's capabilities, so
 * admins can see exactly what each role can reach. Config-driven — no per-role
 * hardcoded menus here.
 */
export function HakAksesClient() {
  const { persona } = usePersona();
  const [role, setRole] = useState<PersonaRole>("site_admin");

  const nav = useMemo(() => filterNavForRole(role), [role]);
  const itemCount = nav.reduce((n, s) => n + s.items.length, 0);
  // A representative persona for the selected role, for its capability flags.
  const sample = useMemo(() => PERSONAS.find((p) => p.role === role) ?? PERSONAS[0], [role]);

  return (
    <div>
      <PageHeader
        title="Hak Akses"
        description="Layout utama & menu dinamis berdasarkan peran (config-driven)."
        breadcrumbs={[{ label: "Master Data" }, { label: "Hak Akses" }]}
      />

      <div className="space-y-6 p-4 md:p-6">
        <PersonaBanner persona={persona} scopeSummary="Kontrol peran" />

        <div className="flex flex-wrap items-center gap-3">
          <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          <label className="text-xs text-muted-foreground">Peran</label>
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {ROLES.map((r) => (
              <button
                key={r.role}
                type="button"
                onClick={() => setRole(r.role)}
                className={
                  role === r.role
                    ? "rounded-md border border-primary bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground"
                    : "rounded-md border border-input bg-background px-2.5 py-1 text-[11px] font-medium hover:bg-accent"
                }
              >
                {r.label}
              </button>
            ))}
          </div>
          <Badge variant="info" className="ml-auto">
            {itemCount} menu · {nav.length} seksi
          </Badge>
        </div>

        {/* Capabilities for the selected role */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-primary" />
              Kapabilitas Peran
            </CardTitle>
            <CardDescription>Hak fungsional yang dimiliki peran ini.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {CAP_META.map((c) => {
                const on = sample.capabilities[c.key];
                const Icon = c.icon;
                return (
                  <span
                    key={c.key}
                    className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs ${
                      on
                        ? "border-emerald-500/40 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400"
                        : "border-border bg-muted text-muted-foreground"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {c.label}
                    {on ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                  </span>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Dynamic menu preview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MenuIcon className="h-4 w-4 text-primary" />
              Menu Dinamis
            </CardTitle>
            <CardDescription>
              Menu yang tampil untuk peran {ROLES.find((r) => r.role === role)?.label}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {nav.map((section) => (
                <div key={section.label} className="rounded-lg border bg-card p-3">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {section.label}
                  </div>
                  <ul className="space-y-1">
                    {section.items.map((item) => {
                      const Icon = item.icon;
                      return (
                        <li
                          key={item.href}
                          className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-accent"
                        >
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          <span>{item.label}</span>
                          {item.badge && (
                            <Badge variant="success" className="ml-auto">
                              {item.badge}
                            </Badge>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
              {nav.length === 0 && (
                <div className="rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">
                  Peran ini tidak memiliki akses menu.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
