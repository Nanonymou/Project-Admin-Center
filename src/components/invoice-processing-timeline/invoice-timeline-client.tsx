"use client";

import { useMemo, useState } from "react";
import { GanttChartSquare, MapPin, CheckCircle2, Clock, CircleDashed } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePersona } from "@/components/providers/persona-provider";
import { canAccessLocation } from "@/lib/personas";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { MOCK_WORKSPACES } from "@/lib/mock/workspaces";
import { getApprovalTimeframes } from "@/lib/mock/approval-timeframe-config";

type StageState = "done" | "current" | "pending";

function seedOf(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffffffff;
  return Math.abs(h);
}

const STATE_META: Record<StageState, { badge: "success" | "info" | "default"; icon: typeof CheckCircle2; label: string }> = {
  done: { badge: "success", icon: CheckCircle2, label: "Selesai" },
  current: { badge: "info", icon: Clock, label: "Berjalan" },
  pending: { badge: "default", icon: CircleDashed, label: "Menunggu" },
};

/**
 * Invoice Processing Timeline — visualizes an invoice's progress through the
 * config-driven approval stages (Verifikasi Site → Approval Leader → Verifikasi
 * Finance → Kirim Client → Payment) with each stage's SLA, actual duration, and
 * status. Seeded per workspace from the shared timeframe config. Persona-scoped;
 * no backend required.
 */
export function InvoiceTimelineClient() {
  const { persona } = usePersona();

  const workspaces = useMemo(
    () => MOCK_WORKSPACES.filter((w) => canAccessLocation(persona, w.locationId, w.projectCode)),
    [persona],
  );
  const [wsIndex, setWsIndex] = useState(0);
  const ws = workspaces[wsIndex] ?? workspaces[0];

  const stages = useMemo(() => {
    if (!ws) return [];
    const flow = getApprovalTimeframes(ws.projectCode, "invoice");
    const seed = seedOf(ws.locationId);
    const currentIdx = seed % flow.length; // stages before are done, after are pending
    const start = new Date();
    start.setDate(start.getDate() - flow.slice(0, currentIdx + 1).reduce((s, f) => s + f.slaDays, 0));
    let cursor = new Date(start);
    return flow.map((f, i) => {
      const state: StageState = i < currentIdx ? "done" : i === currentIdx ? "current" : "pending";
      const startedAt = new Date(cursor);
      const actualDays = state === "pending" ? 0 : Math.max(1, f.slaDays - 1 + ((seed + i) % 3));
      cursor = new Date(cursor);
      cursor.setDate(cursor.getDate() + f.slaDays);
      const breached = state !== "pending" && actualDays > f.slaDays;
      return {
        stage: f.stage,
        slaDays: f.slaDays,
        actualDays,
        state,
        startedAt: state === "pending" ? null : startedAt.toISOString().slice(0, 10),
        breached,
      };
    });
  }, [ws]);

  if (!ws) {
    return (
      <div>
        <PageHeader title="Invoice Processing Timeline" description="Timeline pemrosesan invoice." />
        <div className="p-6 text-sm text-muted-foreground">Tidak ada invoice dalam cakupan Anda.</div>
      </div>
    );
  }

  const seed = seedOf(ws.locationId);
  const invoiceNo = `INV/${new Date().getFullYear()}/${ws.projectCode}/${String(wsIndex + 1).padStart(4, "0")}`;
  const amount = 80_000_000 + (seed % 40) * 1_000_000;
  const doneCount = stages.filter((s) => s.state === "done").length;
  const pct = Math.round((doneCount / stages.length) * 100);

  // Gantt geometry: each stage occupies a horizontal band; its planned bar spans
  // `slaDays` from the cumulative SLA offset, and its actual bar spans `actualDays`.
  const totalSla = stages.reduce((s, st) => s + st.slaDays, 0) || 1;
  let offsetDays = 0;
  const gantt = stages.map((s) => {
    const left = (offsetDays / totalSla) * 100;
    const planWidth = (s.slaDays / totalSla) * 100;
    const actualWidth = (Math.max(0, s.actualDays) / totalSla) * 100;
    offsetDays += s.slaDays;
    return { ...s, left, planWidth, actualWidth };
  });

  return (
    <div>
      <PageHeader
        title="Invoice Processing Timeline"
        description={`Progres pemrosesan invoice per stage · ${ws.projectName} · ${ws.locationName}`}
        breadcrumbs={[{ label: "Operasional" }, { label: "Invoice Processing Timeline" }]}
      />

      <div className="space-y-6 p-4 md:p-6">
        <PersonaBanner persona={persona} scopeSummary={`${workspaces.length} workspace`} />

        <div className="flex flex-wrap items-center gap-3">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <label className="text-xs text-muted-foreground">Workspace</label>
          <select
            value={wsIndex}
            onChange={(e) => setWsIndex(Number(e.target.value))}
            className="h-8 rounded-md border bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-ring"
          >
            {workspaces.map((w, i) => (
              <option key={w.locationId} value={i}>
                {w.projectCode} — {w.locationName}
              </option>
            ))}
          </select>
          <span className="ml-auto text-sm">
            <span className="text-muted-foreground">{invoiceNo}</span> ·{" "}
            <span className="font-semibold tabular-nums">{formatCurrency(amount)}</span>
          </span>
        </div>

        {/* Progress bar */}
        <Card>
          <CardContent className="py-4">
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="font-medium">Progres {pct}%</span>
              <span className="text-muted-foreground">
                {doneCount}/{stages.length} stage selesai
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
            </div>
          </CardContent>
        </Card>

        {/* Gantt chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GanttChartSquare className="h-4 w-4 text-primary" />
              Bagan Gantt
            </CardTitle>
            <CardDescription>Bar rencana (SLA) vs aktivitas aktual per stage.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {gantt.map((s) => (
                <div key={s.stage} className="flex items-center gap-3">
                  <div className="w-36 shrink-0 truncate text-xs font-medium" title={s.stage}>
                    {s.stage}
                  </div>
                  <div className="relative h-6 flex-1 overflow-hidden rounded bg-muted/50">
                    {/* Planned (SLA) bar */}
                    <div
                      className="absolute top-0 h-full rounded bg-primary/20"
                      style={{ left: `${s.left}%`, width: `${s.planWidth}%` }}
                      title={`SLA ${s.slaDays} hari`}
                    />
                    {/* Actual activity bar */}
                    {s.state !== "pending" && (
                      <div
                        className={cn(
                          "absolute top-1 h-4 rounded",
                          s.breached ? "bg-rose-500" : s.state === "done" ? "bg-emerald-500" : "bg-sky-500",
                        )}
                        style={{ left: `${s.left}%`, width: `${Math.max(1, s.actualWidth)}%` }}
                        title={`Aktual ${s.actualDays} hari`}
                      />
                    )}
                  </div>
                  <div className="w-16 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
                    {s.slaDays}h
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-4 rounded bg-primary/20" /> Rencana (SLA)
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-4 rounded bg-emerald-500" /> Selesai
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-4 rounded bg-sky-500" /> Berjalan
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-4 rounded bg-rose-500" /> Lewat SLA
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GanttChartSquare className="h-4 w-4 text-primary" />
              Timeline Stage
            </CardTitle>
            <CardDescription>SLA vs durasi aktual per stage.</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="relative space-y-5 pl-6">
              {stages.map((s, i) => {
                const meta = STATE_META[s.state];
                const Icon = meta.icon;
                return (
                  <li key={s.stage} className="relative">
                    <span className="absolute -left-6 top-0.5 flex h-4 w-4 items-center justify-center">
                      <Icon
                        className={cn(
                          "h-4 w-4",
                          s.state === "done" ? "text-emerald-600" : s.state === "current" ? "text-sky-600" : "text-muted-foreground",
                        )}
                      />
                    </span>
                    {i < stages.length - 1 && (
                      <span className="absolute -left-[18px] top-5 h-full w-px bg-border" aria-hidden />
                    )}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{s.stage}</span>
                      <Badge variant={meta.badge}>{meta.label}</Badge>
                      {s.breached && <Badge variant="danger">Lewat SLA</Badge>}
                      {s.startedAt && (
                        <span className="ml-auto text-[11px] tabular-nums text-muted-foreground">
                          mulai {formatDate(s.startedAt)}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      SLA {s.slaDays} hari
                      {s.state !== "pending" && (
                        <>
                          {" · "}
                          <span className={cn(s.breached && "text-rose-600")}>aktual {s.actualDays} hari</span>
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
