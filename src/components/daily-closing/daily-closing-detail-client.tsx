"use client";

import { useMemo, useState } from "react";
import { notFound, useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Info, Lock, Pencil } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClosingStatusBadge } from "@/components/daily-closing/closing-status-badge";
import { usePersona } from "@/components/providers/persona-provider";
import { SITE_KPI } from "@/lib/mock/site-kpi";
import { canAccessLocation } from "@/lib/personas";
import {
  buildSubmitStatus,
  CLOSING_STATES,
  CLOSING_STATE_META,
  type ClosingState,
} from "@/lib/mock/closing-status";
import { cn } from "@/lib/utils";

export function DailyClosingDetailClient({ locationId }: { locationId: string }) {
  const { persona } = usePersona();
  const router = useRouter();

  const site = SITE_KPI.find((s) => s.locationId === locationId);
  if (!site) notFound();

  const inScope = canAccessLocation(persona, site.locationId, site.projectCode);
  const status = useMemo(() => buildSubmitStatus([site])[0], [site]);

  const overall = useMemo<ClosingState>(() => {
    return CLOSING_STATE_META[status.costState].step <= CLOSING_STATE_META[status.salesState].step
      ? status.costState
      : status.salesState;
  }, [status]);

  const [closingState, setClosingState] = useState<ClosingState>(overall);
  const [notes, setNotes] = useState("");
  const [editing, setEditing] = useState(false);

  const canEdit =
    (persona.role === "site_admin" || persona.role === "leader_admin" || persona.role === "super_admin") &&
    closingState !== "locked";
  const readOnly = !canEdit || !editing;

  const currentStep = CLOSING_STATE_META[closingState].step;

  function advance() {
    const idx = CLOSING_STATES.indexOf(closingState);
    if (idx < CLOSING_STATES.length - 1) setClosingState(CLOSING_STATES[idx + 1]);
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
              <div className="flex items-center justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditing(false)}>
                  Selesai
                </Button>
                <Button size="sm" onClick={advance}>
                  {closingState === "approved" ? <Lock className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
                  {closingState === "approved"
                    ? "Kunci Periode"
                    : `Majukan ke ${CLOSING_STATE_META[CLOSING_STATES[Math.min(CLOSING_STATES.length - 1, currentStep)]].label}`}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
