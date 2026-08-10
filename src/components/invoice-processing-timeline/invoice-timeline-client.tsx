"use client";

import { useMemo, useState } from "react";
import { GanttChartSquare, MapPin, CheckCircle2, Clock, CircleDashed, Pencil, Paperclip, X } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
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
 * Activity-bar color by status: breached (past SLA) is red, at-risk (≥80% of the
 * SLA used but not yet over) is amber, an in-progress stage is sky, a completed
 * on-time stage is emerald. Pending stages have no activity bar.
 */
function barColor(state: StageState, breached: boolean, atRisk: boolean): string {
  if (breached) return "bg-rose-500";
  if (atRisk) return "bg-amber-500";
  if (state === "current") return "bg-sky-500";
  return "bg-emerald-500";
}

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
  const [invoiceIndex, setInvoiceIndex] = useState(0);
  const ws = workspaces[wsIndex] ?? workspaces[0];

  // A few invoices per site — switching them updates the timeline in place.
  const invoiceCount = 3;
  const invoiceOptions = useMemo(
    () =>
      ws
        ? Array.from({ length: invoiceCount }, (_, i) => ({
            index: i,
            number: `INV/${new Date().getFullYear()}/${ws.projectCode}/${String(wsIndex * invoiceCount + i + 1).padStart(4, "0")}`,
          }))
        : [],
    [ws, wsIndex],
  );

  const stages = useMemo(() => {
    if (!ws) return [];
    const flow = getApprovalTimeframes(ws.projectCode, "invoice");
    const seed = seedOf(ws.locationId) + invoiceIndex * 7;
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
  }, [ws, invoiceIndex]);

  // Session-local edits to a stage's date/progress (keyed by stage name).
  type StageOverride = { state?: StageState; startedAt?: string };
  const [overrides, setOverrides] = useState<Record<string, StageOverride>>({});
  const stagesEffective = stages.map((s) => ({ ...s, ...overrides[s.stage] }));

  // Edit modal state.
  const [editStage, setEditStage] = useState<string | null>(null);
  const [editState, setEditState] = useState<StageState>("pending");
  const [editDate, setEditDate] = useState("");
  // Supporting documents attached per stage (session-local, name only).
  const [stageDocs, setStageDocs] = useState<Record<string, string[]>>({});

  function addStageDocs(stage: string, files: FileList | null) {
    if (!files || files.length === 0) return;
    const names = Array.from(files).map((f) => f.name);
    setStageDocs((prev) => ({ ...prev, [stage]: [...(prev[stage] ?? []), ...names] }));
  }

  function removeStageDoc(stage: string, name: string) {
    setStageDocs((prev) => ({ ...prev, [stage]: (prev[stage] ?? []).filter((n) => n !== name) }));
  }

  function openEdit(stage: { stage: string; state: StageState; startedAt: string | null }) {
    setEditStage(stage.stage);
    setEditState(stage.state);
    setEditDate(stage.startedAt ?? new Date().toISOString().slice(0, 10));
  }

  function saveEdit() {
    if (!editStage) return;
    setOverrides((prev) => ({
      ...prev,
      [editStage]: { state: editState, startedAt: editState === "pending" ? undefined : editDate },
    }));
    setEditStage(null);
  }

  if (!ws) {
    return (
      <div>
        <PageHeader title="Invoice Processing Timeline" description="Timeline pemrosesan invoice." />
        <div className="p-6 text-sm text-muted-foreground">Tidak ada invoice dalam cakupan Anda.</div>
      </div>
    );
  }

  const seed = seedOf(ws.locationId) + invoiceIndex * 7;
  const invoiceNo =
    invoiceOptions[invoiceIndex]?.number ??
    `INV/${new Date().getFullYear()}/${ws.projectCode}/${String(wsIndex + 1).padStart(4, "0")}`;
  const amount = 80_000_000 + (seed % 40) * 1_000_000;
  const doneCount = stagesEffective.filter((s) => s.state === "done").length;
  const pct = Math.round((doneCount / stagesEffective.length) * 100);

  // Gantt geometry: each stage occupies a horizontal band; its planned bar spans
  // `slaDays` from the cumulative SLA offset, and its actual bar spans `actualDays`.
  const totalSla = stagesEffective.reduce((s, st) => s + st.slaDays, 0) || 1;
  let offsetDays = 0;
  const gantt = stagesEffective.map((s) => {
    const left = (offsetDays / totalSla) * 100;
    const planWidth = (s.slaDays / totalSla) * 100;
    const actualWidth = (Math.max(0, s.actualDays) / totalSla) * 100;
    offsetDays += s.slaDays;
    // At-risk: used ≥80% of the SLA window but not yet breached.
    const atRisk = s.state !== "pending" && !s.breached && s.actualDays >= s.slaDays * 0.8;
    return { ...s, left, planWidth, actualWidth, atRisk, color: barColor(s.state, s.breached, atRisk) };
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
            onChange={(e) => {
              setWsIndex(Number(e.target.value));
              setInvoiceIndex(0);
            }}
            className="h-8 rounded-md border bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-ring"
          >
            {workspaces.map((w, i) => (
              <option key={w.locationId} value={i}>
                {w.projectCode} — {w.locationName}
              </option>
            ))}
          </select>
          <label className="text-xs text-muted-foreground">Invoice</label>
          <select
            value={invoiceIndex}
            onChange={(e) => setInvoiceIndex(Number(e.target.value))}
            className="h-8 rounded-md border bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-ring"
          >
            {invoiceOptions.map((opt) => (
              <option key={opt.index} value={opt.index}>
                {opt.number}
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
                        className={cn("absolute top-1 h-4 rounded", s.color)}
                        style={{ left: `${s.left}%`, width: `${Math.max(1, s.actualWidth)}%` }}
                        title={`Aktual ${s.actualDays} hari${s.atRisk ? " (mendekati SLA)" : s.breached ? " (lewat SLA)" : ""}`}
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
                <span className="h-2.5 w-4 rounded bg-amber-500" /> Mendekati SLA
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
              {stagesEffective.map((s, i) => {
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
                    {i < stagesEffective.length - 1 && (
                      <span className="absolute -left-[18px] top-5 h-full w-px bg-border" aria-hidden />
                    )}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{s.stage}</span>
                      <Badge variant={meta.badge}>{meta.label}</Badge>
                      {s.breached && <Badge variant="danger">Lewat SLA</Badge>}
                      {(stageDocs[s.stage]?.length ?? 0) > 0 && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Paperclip className="h-3 w-3" />
                          {stageDocs[s.stage].length}
                        </span>
                      )}
                      {s.startedAt && (
                        <span className="text-[11px] tabular-nums text-muted-foreground">
                          mulai {formatDate(s.startedAt)}
                        </span>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="ml-auto h-6 px-2"
                        onClick={() => openEdit(s)}
                        title="Ubah tanggal & progress"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
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

      {/* Edit stage date & progress */}
      <Dialog
        open={editStage !== null}
        onClose={() => setEditStage(null)}
        title="Ubah Aktivitas Stage"
        description={editStage ?? undefined}
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditStage(null)}>
              Batal
            </Button>
            <Button size="sm" onClick={saveEdit}>
              Simpan
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-muted-foreground">Progress</span>
            <select
              value={editState}
              onChange={(e) => setEditState(e.target.value as StageState)}
              className="h-9 rounded-md border bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="pending">Menunggu</option>
              <option value="current">Berjalan</option>
              <option value="done">Selesai</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-muted-foreground">Tanggal mulai</span>
            <input
              type="date"
              value={editDate}
              disabled={editState === "pending"}
              onChange={(e) => setEditDate(e.target.value)}
              className="h-9 rounded-md border bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            />
          </label>

          {/* Supporting documents */}
          <div className="flex flex-col gap-2 text-xs">
            <span className="text-muted-foreground">Dokumen pendukung</span>
            <label className="inline-flex w-fit cursor-pointer items-center gap-1.5 rounded-md border border-input bg-background px-2.5 py-1.5 text-[11px] font-medium hover:bg-accent">
              <Paperclip className="h-3.5 w-3.5" />
              Unggah berkas
              <input
                type="file"
                accept="image/*,.pdf"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (editStage) addStageDocs(editStage, e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
            {editStage && (stageDocs[editStage]?.length ?? 0) > 0 && (
              <ul className="space-y-1">
                {stageDocs[editStage].map((name) => (
                  <li
                    key={name}
                    className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-2 py-1"
                  >
                    <span className="truncate">{name}</span>
                    <button
                      type="button"
                      onClick={() => removeStageDoc(editStage, name)}
                      className="shrink-0 text-muted-foreground hover:text-rose-600"
                      title="Hapus"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Dialog>
    </div>
  );
}
