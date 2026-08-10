"use client";

import { useMemo, useState } from "react";
import { ClipboardCheck, Eye, CheckCircle2, Clock, XCircle, Check, X, Send, LayoutDashboard, Info } from "lucide-react";
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

  const canApprove = persona.capabilities.canApprove;

  const base = useMemo(
    () =>
      buildDailySalesSubmissions().filter((s) => canAccessLocation(persona, s.locationId, s.projectCode)),
    [persona],
  );

  // Session-local status overrides after an approve/reject/submit action.
  const [overrides, setOverrides] = useState<Record<string, DsApprovalStatus>>({});
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);

  const submissions = base.map((s) => ({ ...s, status: overrides[s.id] ?? s.status }));

  const [statusFilter, setStatusFilter] = useState<"all" | DsApprovalStatus>("all");
  const [locationFilter, setLocationFilter] = useState<string>("all");
  const [detail, setDetail] = useState<DailySalesSubmission | null>(null);

  // Reject-with-reason dialog.
  const [rejectTarget, setRejectTarget] = useState<DailySalesSubmission | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  function approve(s: DailySalesSubmission) {
    if (!canApprove) return;
    setOverrides((prev) => ({ ...prev, [s.id]: "approved" }));
    setMsg(`Pengajuan ${s.locationName} ${formatDate(s.trxDate)} disetujui.`);
  }

  function resubmit(s: DailySalesSubmission) {
    setOverrides((prev) => ({ ...prev, [s.id]: "submitted" }));
    setMsg(`Pengajuan ${s.locationName} ${formatDate(s.trxDate)} diajukan ulang.`);
  }

  function confirmReject() {
    if (!rejectTarget || rejectReason.trim().length < 3) return;
    setOverrides((prev) => ({ ...prev, [rejectTarget.id]: "rejected" }));
    setRejectReasons((prev) => ({ ...prev, [rejectTarget.id]: rejectReason.trim() }));
    setMsg(`Pengajuan ${rejectTarget.locationName} ${formatDate(rejectTarget.trxDate)} ditolak.`);
    setRejectTarget(null);
    setRejectReason("");
  }

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

  // Dashboard aggregation — ONLY approved submissions feed the dashboard.
  const approvedDashboard = useMemo(() => {
    const approved = submissions.filter((s) => s.status === "approved");
    const total = approved.reduce((sum, s) => sum + s.total, 0);
    const bySite = new Map<string, { locationName: string; projectCode: string; total: number; count: number }>();
    for (const s of approved) {
      const agg = bySite.get(s.locationId) ?? {
        locationName: s.locationName,
        projectCode: s.projectCode,
        total: 0,
        count: 0,
      };
      agg.total += s.total;
      agg.count += 1;
      bySite.set(s.locationId, agg);
    }
    const excludedTotal = submissions
      .filter((s) => s.status !== "approved")
      .reduce((sum, s) => sum + s.total, 0);
    return {
      total,
      count: approved.length,
      excludedTotal,
      sites: Array.from(bySite.values()).sort((a, b) => b.total - a.total),
    };
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

        {msg && (
          <div className="flex items-center gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{msg}</span>
          </div>
        )}

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

        {/* Approved-only dashboard */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LayoutDashboard className="h-4 w-4 text-primary" />
              Dashboard Sales (hanya data disetujui)
            </CardTitle>
            <CardDescription>
              Hanya pengajuan berstatus <b>Disetujui</b> yang dihitung ke dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <div className="text-2xl font-bold tabular-nums text-primary">
                  {formatCurrency(approvedDashboard.total)}
                </div>
                <div className="text-xs text-muted-foreground">
                  Total sales disetujui · {approvedDashboard.count} pengajuan
                </div>
              </div>
              <div className="ml-auto flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  {formatCurrency(approvedDashboard.excludedTotal)} belum masuk dashboard (menunggu/ditolak).
                </span>
              </div>
            </div>

            {approvedDashboard.sites.length > 0 ? (
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                      <th className="px-3 py-2 text-left font-medium">Site</th>
                      <th className="px-3 py-2 text-right font-medium">Pengajuan Disetujui</th>
                      <th className="px-3 py-2 text-right font-medium">Total Sales</th>
                    </tr>
                  </thead>
                  <tbody>
                    {approvedDashboard.sites.map((site) => (
                      <tr key={`${site.projectCode}-${site.locationName}`} className="border-b last:border-0">
                        <td className="px-3 py-2">
                          <span className="font-medium">{site.locationName}</span>
                          <span className="ml-1 text-[11px] text-muted-foreground">{site.projectCode}</span>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{site.count}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-medium">
                          {formatCurrency(site.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Belum ada pengajuan disetujui pada cakupan Anda.</p>
            )}
          </CardContent>
        </Card>

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
                      <th className="px-3 py-2 text-right font-medium">Aksi</th>
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
                          <td className="px-3 py-2">
                            <div className="flex items-center justify-end gap-1">
                              <Button size="sm" variant="ghost" onClick={() => setDetail(s)} title="Detail">
                                <Eye className="h-4 w-4" />
                              </Button>
                              {canApprove && (s.status === "submitted" || s.status === "reviewed") && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => approve(s)}
                                    title="Setujui"
                                  >
                                    <Check className="h-4 w-4 text-emerald-600" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      setRejectTarget(s);
                                      setRejectReason("");
                                    }}
                                    title="Tolak"
                                  >
                                    <X className="h-4 w-4 text-rose-600" />
                                  </Button>
                                </>
                              )}
                              {s.status === "rejected" && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => resubmit(s)}
                                  title="Ajukan ulang"
                                >
                                  <Send className="h-4 w-4 text-sky-600" />
                                </Button>
                              )}
                            </div>
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

            {detail.status === "rejected" && rejectReasons[detail.id] && (
              <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
                <b>Alasan penolakan:</b> {rejectReasons[detail.id]}
              </div>
            )}

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

      {/* Reject with reason */}
      <Dialog
        open={rejectTarget !== null}
        onClose={() => setRejectTarget(null)}
        title="Tolak Pengajuan"
        description={
          rejectTarget ? `${rejectTarget.locationName} · ${formatDate(rejectTarget.trxDate)}` : undefined
        }
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setRejectTarget(null)}>
              Batal
            </Button>
            <Button
              size="sm"
              className="bg-rose-600 text-white hover:bg-rose-700"
              disabled={rejectReason.trim().length < 3}
              onClick={confirmReject}
            >
              <X className="h-4 w-4" />
              Tolak
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Berikan alasan penolakan. Admin site akan melihat alasan ini dan dapat mengajukan ulang.
          </p>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={3}
            placeholder="Contoh: qty meals melebihi headcount, mohon koreksi."
            className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </Dialog>
    </div>
  );
}
