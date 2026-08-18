"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { notFound, useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Info, Lock, Pencil } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { ClosingStatusBadge } from "@/components/daily-closing/closing-status-badge";
import { usePersona } from "@/components/providers/persona-provider";
import { personaHeaders } from "@/lib/client/notif";
import { SITE_KPI } from "@/lib/mock/site-kpi";
import { canAccessLocation } from "@/lib/personas";
import {
  buildSubmitStatus,
  CLOSING_STATES,
  CLOSING_STATE_META,
  type ClosingState,
} from "@/lib/mock/closing-status";
import { cn } from "@/lib/utils";

type StatusHistoryEntry = { id: string; state: ClosingState; time: string; by: string };

export function DailyClosingDetailClient({ locationId }: { locationId: string }) {
  const { persona } = usePersona();
  const router = useRouter();

  const site = SITE_KPI.find((s) => s.locationId === locationId);
  if (!site) notFound();

  // Narrowed once here so nested callbacks don't lose the non-null narrowing.
  const projectCode = site.projectCode;
  const inScope = canAccessLocation(persona, site.locationId, projectCode);
  const status = useMemo(() => buildSubmitStatus([site])[0], [site]);

  const overall = useMemo<ClosingState>(() => {
    return CLOSING_STATE_META[status.costState].step <= CLOSING_STATE_META[status.salesState].step
      ? status.costState
      : status.salesState;
  }, [status]);

  const [closingState, setClosingState] = useState<ClosingState>(overall);
  const [notes, setNotes] = useState("");
  const [editing, setEditing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // The transition API operates per closing date; default to today.
  const todayIso = new Date().toISOString().slice(0, 10);
  const [closingDate, setClosingDate] = useState(todayIso);
  const [saveNote, setSaveNote] = useState<string | null>(null);

  // Map the DB closing status (open|submitted|approved|locked) to a client state.
  const DB_TO_STATE: Record<string, ClosingState> = useMemo(
    () => ({ open: "draft", submitted: "submitted", approved: "approved", locked: "locked" }),
    [],
  );
  // Map a client target state to the transition API action (reviewed is
  // client-only and has no server action).
  const STATE_TO_ACTION: Partial<Record<ClosingState, string>> = useMemo(
    () => ({ submitted: "submit", approved: "approve", locked: "lock" }),
    [],
  );

  // Reflect the persisted closing status for the selected date, when present.
  const loadClosing = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/daily-closing?projectId=${encodeURIComponent(projectCode)}&locationId=${encodeURIComponent(
          locationId,
        )}&from=${closingDate}&to=${closingDate}&scope=tenant`,
        { headers: personaHeaders(persona.id), cache: "no-store" },
      );
      if (!res.ok) return;
      const data = (await res.json()) as {
        source?: string;
        closings?: Array<{ closingDate: string; status: string }>;
      };
      if (data.source === "db" && Array.isArray(data.closings)) {
        const match = data.closings.find((c) => c.closingDate?.slice(0, 10) === closingDate);
        if (match && DB_TO_STATE[match.status]) setClosingState(DB_TO_STATE[match.status]);
      }
    } catch {
      // keep the mock-derived state
    }
  }, [projectCode, locationId, closingDate, persona.id, DB_TO_STATE]);

  useEffect(() => {
    void loadClosing();
  }, [loadClosing]);

  // Status-change history timeline — seeded from the steps already reached.
  const [history, setHistory] = useState<StatusHistoryEntry[]>(() => {
    const reached = CLOSING_STATES.filter(
      (s) => CLOSING_STATE_META[s].step <= CLOSING_STATE_META[overall].step,
    );
    const seeded = reached.map((s, i) => ({
      id: `seed-${s}`,
      state: s,
      time: `${(reached.length - i) * 6} jam lalu`,
      by: i === 0 ? status.submittedBy : "System",
    }));
    return seeded.reverse();
  });

  const nextState = useMemo<ClosingState | null>(() => {
    const idx = CLOSING_STATES.indexOf(closingState);
    return idx < CLOSING_STATES.length - 1 ? CLOSING_STATES[idx + 1] : null;
  }, [closingState]);

  const actionVerb = useMemo(() => {
    switch (nextState) {
      case "submitted":
        return "Submit";
      case "reviewed":
        return "Review";
      case "approved":
        return "Approve";
      case "locked":
        return "Kunci";
      default:
        return "";
    }
  }, [nextState]);

  const canEdit =
    (persona.role === "site_admin" || persona.role === "leader_admin" || persona.role === "super_admin") &&
    closingState !== "locked";
  const readOnly = !canEdit || !editing;

  const currentStep = CLOSING_STATE_META[closingState].step;

  async function persistTransition(target: ClosingState) {
    const action = STATE_TO_ACTION[target];
    if (!action) return; // "reviewed" is a client-only intermediate step
    try {
      const res = await fetch("/api/daily-closing/transition", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...personaHeaders(persona.id) },
        body: JSON.stringify({
          projectId: projectCode,
          locationId,
          closingDate,
          action,
          note: notes.trim() || undefined,
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { source?: string };
        if (data.source === "db") {
          await loadClosing();
          setSaveNote(`Status closing ${closingDate} tersimpan ke database.`);
          return;
        }
      }
      setSaveNote(null);
    } catch {
      setSaveNote(null);
    }
  }

  function confirmAdvance() {
    if (nextState) {
      setClosingState(nextState);
      setHistory((prev) => [
        { id: `h-${Date.now()}`, state: nextState, time: "baru saja", by: persona.roleLabel },
        ...prev,
      ]);
      void persistTransition(nextState);
    }
    setConfirmOpen(false);
  }

  if (!inScope) {
    return (
      <div className="p-8">
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <Lock className="h-8 w-8 text-muted-foreground" />
            <div className="text-lg font-semibold">Akses ditolak</div>
            <p className="max-w-md text-sm text-muted-foreground">
              Site {site.projectCode} · {site.locationName} di luar scope peran <b>{persona.roleLabel}</b>.
            </p>
            <Button variant="outline" size="sm" onClick={() => router.push("/daily-closing")}>
              Kembali
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={`Detail Closing — ${site.locationName}`}
        description={`${site.projectCode} · closing harian & status penutupan periode.`}
        breadcrumbs={[{ label: "Operasional" }, { label: "Daily Closing" }, { label: site.locationName }]}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => router.push("/daily-closing")}>
              <ArrowLeft className="h-4 w-4" />
              Kembali
            </Button>
            {canEdit && !editing && (
              <Button size="sm" onClick={() => setEditing(true)}>
                <Pencil className="h-4 w-4" />
                Mode Edit
              </Button>
            )}
          </>
        }
      />

      <div className="space-y-6 p-4 md:p-6">
        <PersonaBanner persona={persona} scopeSummary={`${site.projectCode} · ${site.locationName}`} />

        {closingState === "locked" ? (
          <div className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>Periode sudah dikunci — tampilan hanya-baca, tidak dapat diedit.</span>
          </div>
        ) : (
          <div className="flex items-start gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              {editing
                ? "Mode edit aktif — ubah catatan & majukan status closing."
                : "Tampilan hanya-baca. Klik Mode Edit untuk mengubah status closing."}
            </span>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Status Closing</CardTitle>
            <CardDescription>
              Sales & Cost · terakhir diperbarui {status.lastUpdated} oleh {status.submittedBy}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Daily Sales</span>
                <ClosingStatusBadge state={status.salesState} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Daily Cost</span>
                <ClosingStatusBadge state={status.costState} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Overall</span>
                <ClosingStatusBadge state={closingState} showStep />
              </div>
            </div>

            <ol className="flex flex-col gap-2 sm:flex-row sm:items-stretch sm:gap-0">
              {CLOSING_STATES.map((state, i) => {
                const meta = CLOSING_STATE_META[state];
                const done = meta.step < currentStep;
                const active = meta.step === currentStep;
                return (
                  <li key={state} className="flex-1">
                    <div
                      className={cn(
                        "flex items-center justify-between rounded-md border p-2 text-xs sm:h-16 sm:flex-col sm:items-start sm:justify-center sm:rounded-none sm:border-r-0 sm:first:rounded-l-md sm:last:rounded-r-md sm:last:border-r",
                        done && "border-emerald-200 bg-emerald-50 text-emerald-800",
                        active && "border-primary bg-primary/10 text-primary",
                        !done && !active && "border-input bg-muted/40 text-muted-foreground",
                      )}
                    >
                      <span className="text-[10px] font-semibold uppercase tracking-wide">Tahap {i + 1}</span>
                      <span className="text-sm font-medium">{meta.label}</span>
                    </div>
                  </li>
                );
              })}
            </ol>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Catatan Closing</CardTitle>
            <CardDescription>Catatan review / koreksi untuk penutupan periode ini.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              readOnly={readOnly}
              placeholder={readOnly ? "Tidak ada catatan." : "Tulis catatan closing…"}
              rows={4}
              className={cn(
                "w-full rounded-md border border-input bg-background p-2.5 text-sm outline-none focus:ring-2 focus:ring-ring",
                readOnly && "cursor-not-allowed bg-muted/40 text-muted-foreground",
              )}
            />
            {editing && !readOnly && (
              <div className="flex flex-wrap items-center justify-end gap-2">
                <label className="mr-auto flex items-center gap-2 text-xs text-muted-foreground">
                  Tanggal closing
                  <input
                    type="date"
                    value={closingDate}
                    max={todayIso}
                    onChange={(e) => setClosingDate(e.target.value || todayIso)}
                    className="h-8 rounded-md border bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                </label>
                <Button variant="outline" size="sm" onClick={() => setEditing(false)}>
                  Selesai
                </Button>
                {nextState && (
                  <Button size="sm" onClick={() => setConfirmOpen(true)}>
                    {nextState === "locked" ? <Lock className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
                    {actionVerb} → {CLOSING_STATE_META[nextState].label}
                  </Button>
                )}
              </div>
            )}
            {saveNote && (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                {saveNote}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Riwayat Perubahan Status</CardTitle>
            <CardDescription>Timeline transisi status closing periode ini.</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="relative">
              {history.map((h, i) => (
                <li key={h.id} className="flex gap-3 py-2">
                  <div className="relative mt-1 flex flex-col items-center">
                    <span className="h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-background" />
                    {i < history.length - 1 && <span className="mt-1 w-px flex-1 bg-border" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <ClosingStatusBadge state={h.state} />
                      <span className="text-[11px] text-muted-foreground">oleh {h.by}</span>
                      <span className="ml-auto text-[11px] tabular-nums text-muted-foreground">{h.time}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={confirmOpen && nextState !== null}
        onClose={() => setConfirmOpen(false)}
        title={`${actionVerb} Closing`}
        description={nextState ? `Ubah status ke "${CLOSING_STATE_META[nextState].label}"?` : undefined}
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setConfirmOpen(false)}>
              Batal
            </Button>
            <Button
              size="sm"
              variant={nextState === "locked" ? "destructive" : "default"}
              onClick={confirmAdvance}
            >
              {nextState === "locked" ? <Lock className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
              {actionVerb}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-muted-foreground">
          {nextState === "locked"
            ? "Periode akan dikunci dan tidak dapat diedit lagi. Pastikan seluruh entri sudah benar."
            : `Tindakan ini memajukan status closing ${site.projectCode} · ${site.locationName}. Tercatat pada audit trail.`}
        </p>
      </Dialog>
    </div>
  );
}
