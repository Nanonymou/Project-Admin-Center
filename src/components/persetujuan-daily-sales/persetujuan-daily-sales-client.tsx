"use client";

import { useMemo, useState } from "react";
import { ClipboardCheck, Eye, CheckCircle2, Clock, XCircle } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { usePersona } from "@/components/providers/persona-provider";
import { canAccessLocation } from "@/lib/personas";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { getServiceCategories } from "@/lib/mock/service-config";
import {
  buildDailySalesSubmissions,
  DS_APPROVAL_STATUSES,
  DS_STATUS_META,
  type DailySalesSubmission,
  type DsApprovalStatus,
} from "@/lib/mock/daily-sales-approval";

/** Deterministic line-item breakdown for a submission (sums to its total). */
function submissionLines(s: DailySalesSubmission): { label: string; qty: number; amount: number }[] {
  const cats = getServiceCategories(s.projectCode).slice(0, s.itemCount);
  if (cats.length === 0) return [];
  const weights = cats.map((_, i) => 1 + ((i * 7 + s.locationId.length) % 5));
  const weightSum = weights.reduce((a, b) => a + b, 0);
  return cats.map((c, i) => {
    const amount = Math.round((weights[i] / weightSum) * s.total);
    const price = c.defaultPrice || 1;
    return { label: c.label, qty: Math.max(1, Math.round(amount / price)), amount };
  });
}

/** Approval-history steps for a submission, based on its current status. */
function approvalSteps(s: DailySalesSubmission): { label: string; state: "done" | "current" | "pending" | "rejected"; note: string }[] {
  const order: DsApprovalStatus[] = ["submitted", "reviewed", "approved"];
  const idx = s.status === "rejected" ? 1 : order.indexOf(s.status);
  return [
    { label: "Diajukan", state: "done", note: `${s.submittedBy} · ${formatDate(s.trxDate)}` },
    {
      label: "Direview",
      state:
        s.status === "rejected"
          ? "rejected"
          : idx >= 1
            ? "done"
            : "current",
      note: s.status === "rejected" ? "Ditolak reviewer" : idx >= 1 ? "Reviewer site" : "Menunggu review",
    },
    {
      label: "Disetujui",
      state: s.status === "approved" ? "done" : s.status === "rejected" ? "pending" : idx >= 1 ? "current" : "pending",
      note: s.status === "approved" ? "Leader Admin" : "Menunggu approval",
    },
  ];
}

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
  const [detail, setDetail] = useState<DailySalesSubmission | null>(null);

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
                      <th className="px-3 py-2 text-right font-medium">Detail</th>
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
                          <td className="px-3 py-2 text-right">
                            <Button size="sm" variant="outline" onClick={() => setDetail(s)}>
                              <Eye className="h-4 w-4" />
                            </Button>
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

      {/* Submission detail + approval history */}
      <Dialog
        open={detail !== null}
        onClose={() => setDetail(null)}
        title="Detail Pengajuan Daily Sales"
        description={detail ? `${detail.locationName} · ${detail.projectCode} · ${formatDate(detail.trxDate)}` : undefined}
        className="max-w-2xl"
      >
        {detail && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Badge variant={DS_STATUS_META[detail.status].badge}>{DS_STATUS_META[detail.status].label}</Badge>
              <span className="text-muted-foreground">Diajukan oleh {detail.submittedBy}</span>
              <span className="ml-auto font-medium tabular-nums">{formatCurrency(detail.total)}</span>
            </div>

            {/* Line items */}
            <div>
              <div className="mb-1 text-xs font-medium text-muted-foreground">Rincian</div>
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-muted/40 text-[10px] uppercase tracking-wide text-muted-foreground">
                      <th className="px-2 py-1.5 text-left font-medium">Kategori</th>
                      <th className="px-2 py-1.5 text-right font-medium">Qty</th>
                      <th className="px-2 py-1.5 text-right font-medium">Jumlah</th>
                    </tr>
                  </thead>
                  <tbody>
                    {submissionLines(detail).map((l, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="px-2 py-1.5">{l.label}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{l.qty}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{formatCurrency(l.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Approval history */}
            <div>
              <div className="mb-2 text-xs font-medium text-muted-foreground">Riwayat Persetujuan</div>
              <ol className="space-y-2">
                {approvalSteps(detail).map((step, i) => {
                  const Icon =
                    step.state === "done" ? CheckCircle2 : step.state === "rejected" ? XCircle : Clock;
                  const color =
                    step.state === "done"
                      ? "text-emerald-600"
                      : step.state === "rejected"
                        ? "text-rose-600"
                        : step.state === "current"
                          ? "text-sky-600"
                          : "text-muted-foreground";
                  return (
                    <li key={i} className="flex items-start gap-2">
                      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", color)} />
                      <div>
                        <div className="text-sm font-medium">{step.label}</div>
                        <div className="text-[11px] text-muted-foreground">{step.note}</div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
