"use client";

import { useMemo, useState } from "react";
import { ClipboardCheck, ShoppingCart } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePersona } from "@/components/providers/persona-provider";
import { canAccessLocation } from "@/lib/personas";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import {
  buildDailySalesSubmissions,
  DS_APPROVAL_STATUSES,
  DS_STATUS_META,
  type DsApprovalStatus,
} from "@/lib/mock/daily-sales-approval";

/**
 * Persetujuan Daily Sales — approval list. Shows recent Daily Sales submissions
 * per site with their approval status, filterable by status and site. Scoped to
 * the persona; seeded from mock data with no backend required. Approval actions
 * are added in later tasks.
 */
export function PersetujuanDailySalesClient() {
  const { persona } = usePersona();

  const submissions = useMemo(
    () =>
      buildDailySalesSubmissions().filter((s) => canAccessLocation(persona, s.locationId, s.projectCode)),
    [persona],
  );

  const [statusFilter, setStatusFilter] = useState<"all" | DsApprovalStatus>("all");
  const [locationFilter, setLocationFilter] = useState<string>("all");

  const locations = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of submissions) map.set(s.locationId, `${s.locationName} · ${s.projectCode}`);
    return Array.from(map, ([id, label]) => ({ id, label }));
  }, [submissions]);

  const visible = useMemo(
    () =>
      submissions.filter(
        (s) =>
          (statusFilter === "all" || s.status === statusFilter) &&
          (locationFilter === "all" || s.locationId === locationFilter),
      ),
    [submissions, statusFilter, locationFilter],
  );

  const counts = useMemo(() => {
    const c: Record<DsApprovalStatus, number> = { submitted: 0, reviewed: 0, approved: 0, rejected: 0 };
    for (const s of submissions) c[s.status] += 1;
    return c;
  }, [submissions]);

  return (
    <div>
      <PageHeader
        title="Persetujuan Daily Sales"
        description="Tinjau dan pantau status persetujuan pengajuan Daily Sales per site."
        breadcrumbs={[{ label: "Operasional" }, { label: "Persetujuan Daily Sales" }]}
      />

      <div className="space-y-6 p-4 md:p-6">
        <PersonaBanner persona={persona} scopeSummary={`${locations.length} site`} />

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {DS_APPROVAL_STATUSES.map((s) => {
            const meta = DS_STATUS_META[s];
            return (
              <Card key={s}>
                <CardContent className="flex items-center justify-between py-4">
                  <div>
                    <div className="text-2xl font-semibold tabular-nums">{counts[s]}</div>
                    <div className="text-xs text-muted-foreground">{meta.label}</div>
                  </div>
                  <Badge variant={meta.badge}>{meta.label.split(" ")[0]}</Badge>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card>
          <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4 text-primary" />
                Pengajuan Daily Sales
              </CardTitle>
              <CardDescription>{visible.length} pengajuan pada cakupan Anda.</CardDescription>
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
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                {(["all", ...DS_APPROVAL_STATUSES] as const).map((s) => (
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
                    {s === "all" ? "Semua" : DS_STATUS_META[s].label}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {visible.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                Tidak ada pengajuan sesuai filter.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                      <th className="px-3 py-2 text-left font-medium">Tanggal</th>
                      <th className="px-3 py-2 text-left font-medium">Site</th>
                      <th className="px-3 py-2 text-right font-medium">Item</th>
                      <th className="px-3 py-2 text-right font-medium">Total</th>
                      <th className="px-3 py-2 text-left font-medium">Diajukan</th>
                      <th className="px-3 py-2 text-left font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((s) => {
                      const meta = DS_STATUS_META[s.status];
                      return (
                        <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="px-3 py-2 whitespace-nowrap">{formatDate(s.trxDate)}</td>
                          <td className="px-3 py-2">
                            <span className="font-medium">{s.locationName}</span>
                            <span className="ml-1 text-[11px] text-muted-foreground">{s.projectCode}</span>
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">{s.itemCount}</td>
                          <td className="px-3 py-2 text-right tabular-nums font-medium">
                            {formatCurrency(s.total)}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">{s.submittedBy}</td>
                          <td className="px-3 py-2">
                            <Badge variant={meta.badge}>{meta.label}</Badge>
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
