"use client";

import { useMemo, useState } from "react";
import { Send, Wallet, CheckCircle2, Undo2 } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { usePersona } from "@/components/providers/persona-provider";
import { canAccessLocation } from "@/lib/personas";
import { cn, formatCurrency } from "@/lib/utils";
import { SITE_KPI } from "@/lib/mock/site-kpi";
import {
  buildSubmitStatus,
  CLOSING_STATE_META,
  type ClosingState,
} from "@/lib/mock/closing-status";

const BADGE_VARIANT: Record<ClosingState, "default" | "info" | "warning" | "success"> = {
  draft: "default",
  submitted: "info",
  reviewed: "warning",
  approved: "success",
  locked: "success",
};

/**
 * Submit Daily Cost — main page. Lists each site's Daily Cost closing state for
 * the current period and lets a site admin submit a draft for approval. Submit
 * advances the state draft → submitted (mock, session-local). Persona-scoped;
 * cross-site view is available to Leader/Super Admin.
 */
export function SubmitDailyCostClient() {
  const { persona } = usePersona();
  const canSubmit =
    persona.role === "site_admin" || persona.role === "leader_admin" || persona.role === "super_admin";

  const sites = useMemo(
    () => SITE_KPI.filter((s) => canAccessLocation(persona, s.locationId, s.projectCode)),
    [persona],
  );
  const baseline = useMemo(() => buildSubmitStatus(sites), [sites]);

  // Session-local overrides for cost state after a submit action.
  const [overrides, setOverrides] = useState<Record<string, ClosingState>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ locationId: string; locationName: string } | null>(null);

  const rows = baseline.map((r) => ({
    ...r,
    costState: overrides[r.locationId] ?? r.costState,
    // Only rows the user submitted this session can be reverted locally.
    submittedLocally: overrides[r.locationId] === "submitted",
    dailyCost: SITE_KPI.find((s) => s.locationId === r.locationId)?.cost ?? 0,
  }));

  function confirmSubmit() {
    if (!confirm) return;
    setOverrides((prev) => ({ ...prev, [confirm.locationId]: "submitted" }));
    setMsg(`Daily Cost ${confirm.locationName} berhasil disubmit untuk approval.`);
    setConfirm(null);
  }

  function undo(locationId: string, locationName: string) {
    setOverrides((prev) => {
      const next = { ...prev };
      delete next[locationId];
      return next;
    });
    setMsg(`Submit ${locationName} dibatalkan — kembali ke draft.`);
  }

  const counts = useMemo(() => {
    const c = { draft: 0, submitted: 0, done: 0 };
    for (const r of rows) {
      if (r.costState === "draft") c.draft += 1;
      else if (r.costState === "submitted" || r.costState === "reviewed") c.submitted += 1;
      else c.done += 1;
    }
    return c;
  }, [rows]);

  const isLeader = persona.role === "leader_admin" || persona.role === "super_admin";

  // Per-project recap for the Leader Admin — sites submitted vs still pending.
  const projectRecap = useMemo(() => {
    const map = new Map<string, { total: number; draft: number; inProgress: number; done: number }>();
    for (const r of rows) {
      const agg = map.get(r.projectCode) ?? { total: 0, draft: 0, inProgress: 0, done: 0 };
      agg.total += 1;
      if (r.costState === "draft") agg.draft += 1;
      else if (r.costState === "submitted" || r.costState === "reviewed") agg.inProgress += 1;
      else agg.done += 1;
      map.set(r.projectCode, agg);
    }
    return Array.from(map, ([projectCode, agg]) => ({ projectCode, ...agg })).sort((a, b) =>
      a.projectCode.localeCompare(b.projectCode),
    );
  }, [rows]);

  return (
    <div>
      <PageHeader
        title="Submit Daily Cost"
        description="Kirim Daily Cost harian per site untuk proses approval."
        breadcrumbs={[{ label: "Operasional" }, { label: "Submit Daily Cost" }]}
      />

      <div className="space-y-6 p-4 md:p-6">
        <PersonaBanner persona={persona} scopeSummary={`${sites.length} site`} />

        {msg && (
          <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{msg}</span>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="py-4">
              <div className="text-2xl font-semibold tabular-nums">{counts.draft}</div>
              <div className="text-xs text-muted-foreground">Belum disubmit (draft)</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <div className="text-2xl font-semibold tabular-nums">{counts.submitted}</div>
              <div className="text-xs text-muted-foreground">Dalam proses approval</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <div className="text-2xl font-semibold tabular-nums">{counts.done}</div>
              <div className="text-xs text-muted-foreground">Selesai (approved/locked)</div>
            </CardContent>
          </Card>
        </div>

        {/* Leader Admin recap — per-project submit progress across all sites */}
        {isLeader && projectRecap.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Rekap Status per Project (Leader Admin)</CardTitle>
              <CardDescription>Progres submit Daily Cost seluruh site per project.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                      <th className="px-3 py-2 text-left font-medium">Project</th>
                      <th className="px-3 py-2 text-right font-medium">Total Site</th>
                      <th className="px-3 py-2 text-right font-medium">Draft</th>
                      <th className="px-3 py-2 text-right font-medium">Proses</th>
                      <th className="px-3 py-2 text-right font-medium">Selesai</th>
                      <th className="px-3 py-2 text-left font-medium">Progres</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projectRecap.map((p) => {
                      const submittedPct = p.total > 0 ? ((p.inProgress + p.done) / p.total) * 100 : 0;
                      return (
                        <tr key={p.projectCode} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="px-3 py-2 font-medium">{p.projectCode}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{p.total}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{p.draft}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-sky-700">{p.inProgress}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-emerald-700">{p.done}</td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-28 overflow-hidden rounded-full bg-muted">
                                <div
                                  className="h-full rounded-full bg-primary"
                                  style={{ width: `${submittedPct}%` }}
                                />
                              </div>
                              <span className="text-[11px] tabular-nums text-muted-foreground">
                                {submittedPct.toFixed(0)}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-primary" />
              Status Submit Daily Cost per Site
            </CardTitle>
            <CardDescription>Submit hanya tersedia untuk entri berstatus draft.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {rows.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">Tidak ada site dalam cakupan Anda.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                      <th className="px-3 py-2 text-left font-medium">Site</th>
                      <th className="px-3 py-2 text-right font-medium">Cost (bulan)</th>
                      <th className="px-3 py-2 text-left font-medium">Status</th>
                      <th className="px-3 py-2 text-left font-medium">Terakhir</th>
                      <th className="px-3 py-2 text-right font-medium">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const meta = CLOSING_STATE_META[r.costState];
                      return (
                        <tr key={r.locationId} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="px-3 py-2">
                            <span className="font-medium">{r.locationName}</span>
                            <span className="ml-1 text-[11px] text-muted-foreground">{r.projectCode}</span>
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(r.dailyCost)}</td>
                          <td className="px-3 py-2">
                            <Badge variant={BADGE_VARIANT[r.costState]}>{meta.label}</Badge>
                          </td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">{r.lastUpdated}</td>
                          <td className="px-3 py-2 text-right">
                            {r.submittedLocally ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <Badge variant="info">Terkirim</Badge>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => undo(r.locationId, r.locationName)}
                                  title="Batalkan submit"
                                >
                                  <Undo2 className="h-4 w-4" />
                                </Button>
                              </div>
                            ) : (
                              <Button
                                size="sm"
                                variant={r.costState === "draft" ? "default" : "outline"}
                                disabled={!canSubmit || r.costState !== "draft"}
                                onClick={() => setConfirm({ locationId: r.locationId, locationName: r.locationName })}
                              >
                                <Send className="h-4 w-4" />
                                {r.costState === "draft" ? "Submit" : "Terkirim"}
                              </Button>
                            )}
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

        {/* Approval progress legend */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Alur Status Closing</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {(Object.keys(CLOSING_STATE_META) as ClosingState[]).map((s, i) => (
                <div key={s} className="flex items-center gap-2">
                  <span
                    className={cn(
                      "rounded-md border px-2 py-1 font-medium",
                      "border-input bg-background",
                    )}
                  >
                    {i + 1}. {CLOSING_STATE_META[s].label}
                  </span>
                  {i < 4 && <span className="text-muted-foreground">→</span>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Submit confirmation */}
      <Dialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title="Submit Daily Cost?"
        description={confirm ? confirm.locationName : undefined}
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setConfirm(null)}>
              Batal
            </Button>
            <Button size="sm" onClick={confirmSubmit}>
              <Send className="h-4 w-4" />
              Submit
            </Button>
          </div>
        }
      >
        <p className="text-sm text-muted-foreground">
          Daily Cost <b>{confirm?.locationName}</b> akan dikirim untuk proses approval. Setelah disubmit,
          status berpindah dari Draft ke Submitted.
        </p>
      </Dialog>
    </div>
  );
}
