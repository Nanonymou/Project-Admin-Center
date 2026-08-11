"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  MapPin,
  ShoppingCart,
  Wallet,
  TrendingUp,
  ShieldAlert,
  Clock,
  ArrowRight,
  LayoutGrid,
} from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePersona } from "@/components/providers/persona-provider";
import { canAccessLocation } from "@/lib/personas";
import { formatCurrency } from "@/lib/utils";
import { SITE_KPI } from "@/lib/mock/site-kpi";
import { filterNavForRole } from "@/lib/mock/access-config";

const CLOSING_META: Record<string, { label: string; variant: "success" | "warning" | "danger" }> = {
  open: { label: "Terbuka", variant: "success" },
  closing: { label: "Closing", variant: "warning" },
  locked: { label: "Terkunci", variant: "danger" },
};

/**
 * Workspace Site Admin — a single-site admin's focused home. Shows their site's
 * KPIs and a quick-access grid built from the role-limited menu
 * (`filterNavForRole`), so the shortcuts always match what the persona may
 * actually open. Leaders/super admins opening this see the first site in scope.
 * Persona-scoped; complements the leader's multi-site workspace landing.
 */
export function SiteWorkspaceClient() {
  const { persona } = usePersona();

  const sites = useMemo(
    () => SITE_KPI.filter((s) => canAccessLocation(persona, s.locationId, s.projectCode)),
    [persona],
  );
  const site = sites[0];

  // Quick links = the operational menu this role is allowed to see.
  const quickLinks = useMemo(() => {
    const nav = filterNavForRole(persona.role);
    const ops = nav.find((s) => s.label === "Operasional");
    return (ops?.items ?? []).slice(0, 8);
  }, [persona.role]);

  if (!site) {
    return (
      <div>
        <PageHeader title="Workspace Site" description="Workspace site admin." />
        <div className="p-6 text-sm text-muted-foreground">Tidak ada site dalam cakupan Anda.</div>
      </div>
    );
  }

  const stats = [
    { label: "Sales", value: formatCurrency(site.sales), icon: ShoppingCart, tone: "text-emerald-600" },
    { label: "Cost", value: formatCurrency(site.cost), icon: Wallet, tone: "text-rose-600" },
    { label: "Net Margin", value: `${site.marginPct.toFixed(1)}%`, icon: TrendingUp, tone: "text-sky-600" },
    { label: "SLA", value: `${site.slaPct.toFixed(0)}%`, icon: ShieldAlert, tone: "text-amber-600" },
  ];

  return (
    <div>
      <PageHeader
        title="Workspace Site"
        description="Ruang kerja terfokus untuk site Anda dengan menu terbatas."
        breadcrumbs={[{ label: "Overview" }, { label: "Workspace Site" }]}
      />

      <div className="space-y-6 p-4 md:p-6">
        <PersonaBanner persona={persona} scopeSummary={`${sites.length} site`} />

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  {site.locationName}
                </CardTitle>
                <CardDescription className="mt-1">
                  {site.projectName} · {site.projectCode} · Periode {site.invoicePeriod}
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={CLOSING_META[site.closingStatus].variant}>
                  {CLOSING_META[site.closingStatus].label}
                </Badge>
                <Badge variant="muted" className="gap-1">
                  <Clock className="h-3 w-3" />
                  Cut-off {site.cutOffDaysLeft} hari
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {stats.map((s) => {
                const Icon = s.icon;
                return (
                  <div key={s.label} className="rounded-md border p-3">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Icon className={`h-3.5 w-3.5 ${s.tone}`} />
                      {s.label}
                    </div>
                    <div className="mt-1 text-lg font-semibold tabular-nums">{s.value}</div>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <ShieldAlert className="h-3.5 w-3.5" />
                {site.overdueInvoices} invoice overdue
              </span>
              <span>· {site.pendingApprovals} approval menunggu</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <LayoutGrid className="h-4 w-4 text-primary" />
              Menu Kerja
            </CardTitle>
            <CardDescription>Akses cepat sesuai hak akses peran Anda ({persona.roleLabel}).</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {quickLinks.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="group flex items-center gap-2 rounded-md border px-3 py-2.5 text-sm transition hover:border-primary hover:bg-accent"
                  >
                    <Icon className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" />
                    <span className="flex-1 truncate">{item.label}</span>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
