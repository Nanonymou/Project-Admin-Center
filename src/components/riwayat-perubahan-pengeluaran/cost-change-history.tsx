"use client";

import { useMemo, useState } from "react";
import { History, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePersona } from "@/components/providers/persona-provider";
import { canAccessLocation } from "@/lib/personas";
import { cn, formatCurrency, formatDateTime, formatDate } from "@/lib/utils";
import {
  buildCostChangeLog,
  COST_CHANGE_ACTIONS,
  COST_CHANGE_ACTION_META,
  type CostChangeAction,
} from "@/lib/mock/cost-change-log";

/**
 * Cost change-history page (Riwayat Perubahan Pengeluaran). Shows an append-only
 * trail of create / update / delete actions on Daily Cost entries, scoped to the
 * persona and filterable by action and site. Seeded from mock data; no backend
 * required at this stage.
 */
export function CostChangeHistory() {
  const { persona } = usePersona();

  const entries = useMemo(
    () => buildCostChangeLog().filter((e) => canAccessLocation(persona, e.locationId, e.projectCode)),
    [persona],
  );

  const [actionFilter, setActionFilter] = useState<"all" | CostChangeAction>("all");
  const [locationFilter, setLocationFilter] = useState<string>("all");

  const locations = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of entries) map.set(e.locationId, `${e.locationName} · ${e.projectCode}`);
    return Array.from(map, ([id, label]) => ({ id, label }));
  }, [entries]);

  const visible = useMemo(
    () =>
      entries.filter(
        (e) =>
          (actionFilter === "all" || e.action === actionFilter) &&
          (locationFilter === "all" || e.locationId === locationFilter),
      ),
    [entries, actionFilter, locationFilter],
  );

  const counts = useMemo(() => {
    const c: Record<CostChangeAction, number> = { create: 0, update: 0, delete: 0 };
    for (const e of entries) c[e.action] += 1;
    return c;
  }, [entries]);

  return (
    <div>
      <PageHeader
        title="Riwayat Perubahan Pengeluaran"
        description="Jejak audit perubahan entri Daily Cost — siapa mengubah apa dan kapan."
        breadcrumbs={[{ label: "Operasional" }, { label: "Riwayat Perubahan Pengeluaran" }]}
      />

      <div className="space-y-6 p-4 md:p-6">
        <PersonaBanner persona={persona} scopeSummary={`${locations.length} site`} />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {COST_CHANGE_ACTIONS.map((a) => {
            const meta = COST_CHANGE_ACTION_META[a];
            return (
              <Card key={a}>
                <CardContent className="flex items-center justify-between py-4">
                  <div>
                    <div className="text-2xl font-semibold tabular-nums">{counts[a]}</div>
                    <div className="text-xs text-muted-foreground">Entri {meta.label.toLowerCase()}</div>
                  </div>
                  <Badge variant={meta.badge}>{meta.label}</Badge>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card>
          <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2">
                <History className="h-4 w-4 text-primary" />
                Log Perubahan
              </CardTitle>
              <CardDescription>{visible.length} perubahan pada cakupan Anda.</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                className="h-8 rounded-md border bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="all">Semua Site</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label}
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-1.5 text-xs">
                {(["all", ...COST_CHANGE_ACTIONS] as const).map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setActionFilter(a)}
                    className={cn(
                      "rounded-md border px-2 py-1 text-[11px] font-medium",
                      actionFilter === a
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input bg-background hover:bg-accent",
                    )}
                  >
                    {a === "all" ? "Semua" : COST_CHANGE_ACTION_META[a].label}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {visible.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                Tidak ada perubahan sesuai filter.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                      <th className="px-3 py-2 text-left font-medium">Waktu Ubah</th>
                      <th className="px-3 py-2 text-left font-medium">Site</th>
                      <th className="px-3 py-2 text-left font-medium">Tgl Transaksi</th>
                      <th className="px-3 py-2 text-left font-medium">Kategori</th>
                      <th className="px-3 py-2 text-left font-medium">Aksi</th>
                      <th className="px-3 py-2 text-right font-medium">Perubahan</th>
                      <th className="px-3 py-2 text-left font-medium">Oleh</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((e) => {
                      const meta = COST_CHANGE_ACTION_META[e.action];
                      return (
                        <tr key={e.id} className="border-b last:border-0 hover:bg-muted/30 align-top">
                          <td className="px-3 py-2 whitespace-nowrap text-xs">{formatDateTime(e.at)}</td>
                          <td className="px-3 py-2">
                            <span className="font-medium">{e.locationName}</span>
                            <span className="ml-1 text-[11px] text-muted-foreground">{e.projectCode}</span>
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">{formatDate(e.trxDate)}</td>
                          <td className="px-3 py-2 text-muted-foreground">{e.categoryLabel}</td>
                          <td className="px-3 py-2">
                            <Badge variant={meta.badge}>{meta.label}</Badge>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <div className="flex items-center justify-end gap-2 tabular-nums">
                              <span className={cn("text-muted-foreground", e.before !== null && "line-through")}>
                                {e.before !== null ? formatCurrency(e.before) : "—"}
                              </span>
                              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="font-medium">
                                {e.after !== null ? formatCurrency(e.after) : "—"}
                              </span>
                            </div>
                            {e.reason && (
                              <div className="text-right text-[11px] text-muted-foreground">{e.reason}</div>
                            )}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">{e.editor}</td>
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
