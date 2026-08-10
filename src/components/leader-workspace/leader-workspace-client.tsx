"use client";

import { useMemo, useState } from "react";
import { LayoutGrid, MapPin, ArrowRight, CheckCircle2, TrendingUp, ShoppingCart, Wallet } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePersona } from "@/components/providers/persona-provider";
import { canAccessLocation } from "@/lib/personas";
import { formatCurrency } from "@/lib/utils";
import { SITE_KPI } from "@/lib/mock/site-kpi";

/**
 * Dashboard Leader & Workspace — the leader's entry point: a Site Card grid for
 * every workspace in scope, each with quick KPIs and an "Open Workspace" action
 * (per the PRD's System Workflow). The active workspace is chosen either from the
 * picker or by opening a card, and is highlighted. Persona-scoped: only sites the
 * leader may access are shown. Distinct from the analytics leader dashboard.
 */
export function LeaderWorkspaceClient() {
  const { persona } = usePersona();

  const sites = useMemo(
    () => SITE_KPI.filter((s) => canAccessLocation(persona, s.locationId, s.projectCode)),
    [persona],
  );
  const [activeId, setActiveId] = useState<string>(sites[0]?.locationId ?? "");
  const active = sites.find((s) => s.locationId === activeId) ?? sites[0];

  if (sites.length === 0) {
    return (
      <div>
        <PageHeader title="Dashboard Leader & Workspace" description="Pilih workspace site." />
        <div className="p-6 text-sm text-muted-foreground">Tidak ada site dalam cakupan Anda.</div>
      </div>
    );
  }

  const totalSales = sites.reduce((n, s) => n + s.sales, 0);
  const totalCost = sites.reduce((n, s) => n + s.cost, 0);
  const avgMargin = totalSales > 0 ? ((totalSales - totalCost) / totalSales) * 100 : 0;

  return (
    <div>
      <PageHeader
        title="Dashboard Leader & Workspace"
        description="Kelola dan buka workspace seluruh site dalam tanggung jawab Anda."
        breadcrumbs={[{ label: "Overview" }, { label: "Dashboard Leader & Workspace" }]}
      />

      <div className="space-y-6 p-4 md:p-6">
        <PersonaBanner persona={persona} scopeSummary={`${sites.length} site`} />

        <div className="flex flex-wrap items-center gap-3">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <label className="text-xs text-muted-foreground">Workspace aktif</label>
          <select
            value={activeId}
            onChange={(e) => setActiveId(e.target.value)}
            className="h-8 rounded-md border bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-ring"
          >
            {sites.map((s) => (
              <option key={s.locationId} value={s.locationId}>
                {s.projectName} — {s.locationName} ({s.projectCode})
              </option>
            ))}
          </select>
          {active && (
            <Badge variant="success" className="gap-1">
              <CheckCircle2 className="h-3 w-3" />
              {active.locationName} aktif
            </Badge>
          )}
        </div>

        {/* Portfolio summary */}
        <div className="grid gap-3 sm:grid-cols-3">
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <ShoppingCart className="h-5 w-5 text-sky-500" />
              <div>
                <div className="text-xs text-muted-foreground">Total Sales</div>
                <div className="font-semibold tabular-nums">{formatCurrency(totalSales)}</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <Wallet className="h-5 w-5 text-amber-500" />
              <div>
                <div className="text-xs text-muted-foreground">Total Cost</div>
                <div className="font-semibold tabular-nums">{formatCurrency(totalCost)}</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <TrendingUp className="h-5 w-5 text-emerald-500" />
              <div>
                <div className="text-xs text-muted-foreground">Rata-rata Margin</div>
                <div className="font-semibold tabular-nums">{avgMargin.toFixed(1)}%</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Site cards */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LayoutGrid className="h-4 w-4 text-primary" />
              Site Cards
            </CardTitle>
            <CardDescription>Buka workspace site untuk masuk ke ruang kerjanya.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {sites.map((s) => {
                const isActive = s.locationId === activeId;
                return (
                  <div
                    key={s.locationId}
                    className={`flex flex-col rounded-lg border p-4 shadow-sm ${
                      isActive ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20" : "bg-card"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold">{s.locationName}</div>
                        <div className="text-xs text-muted-foreground">{s.projectName}</div>
                      </div>
                      <Badge variant="info">{s.projectCode}</Badge>
                    </div>
                    <div className="mt-3 space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Sales</span>
                        <span className="font-medium tabular-nums">{formatCurrency(s.sales)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Cost</span>
                        <span className="font-medium tabular-nums">{formatCurrency(s.cost)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Margin</span>
                        <span className="font-medium tabular-nums">{s.marginPct.toFixed(1)}%</span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant={isActive ? "outline" : "default"}
                      onClick={() => setActiveId(s.locationId)}
                      className="mt-3 gap-1.5"
                      disabled={isActive}
                    >
                      {isActive ? "Workspace Aktif" : "Buka Workspace"}
                      {!isActive && <ArrowRight className="h-4 w-4" />}
                    </Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
