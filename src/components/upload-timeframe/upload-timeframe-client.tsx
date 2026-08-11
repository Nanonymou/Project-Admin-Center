"use client";

import { useMemo, useState } from "react";
import {
  CalendarClock,
  Clock,
  MapPin,
  User,
  FileCheck2,
  ArrowRight,
  GitBranch,
  CheckCircle2,
  ListChecks,
  Trash2,
} from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { usePersona } from "@/components/providers/persona-provider";
import { canAccessLocation } from "@/lib/personas";
import { MOCK_WORKSPACES } from "@/lib/mock/workspaces";
import { getApprovalTimeframes } from "@/lib/mock/approval-timeframe-config";

type ConfirmedWorkflow = {
  id: string;
  projectCode: string;
  projectName: string;
  locationName: string;
  subject: "invoice" | "daily_closing";
  stageCount: number;
  totalSla: number;
  confirmedAt: string;
};

type SubjectType = "invoice" | "daily_closing";

/** Default responsible role (PIC) per stage — mirrors the server workflow resolver. */
function roleForStage(stage: string): string {
  const s = stage.toLowerCase();
  if (s.includes("site")) return "Site Admin";
  if (s.includes("leader")) return "Leader Admin";
  if (s.includes("finance")) return "Finance";
  if (s.includes("client")) return "Site Admin";
  if (s.includes("payment")) return "Client";
  return "Site Admin";
}

/** Default stage nature per stage — mirrors the server workflow resolver. */
function typeForStage(stage: string): { label: string; variant: "info" | "success" | "warning" | "default" } {
  const s = stage.toLowerCase();
  if (s.includes("approval") || s.includes("leader")) return { label: "Approval", variant: "success" };
  if (s.includes("kirim") || s.includes("client")) return { label: "Pengiriman", variant: "warning" };
  if (s.includes("payment")) return { label: "Pembayaran", variant: "default" };
  return { label: "Verifikasi", variant: "info" };
}

/**
 * Master Timeframe (Upload Timeframe) — displays the config-driven default
 * approval timeframe (SLA per stage) for the selected site's project and
 * document type. The site picker chooses a workspace; master timeframes are
 * keyed by project code, so switching sites shows that project's flow. Read-only
 * view here; upload/editing is layered on by subsequent tasks. Persona-scoped.
 */
export function UploadTimeframeClient() {
  const { persona } = usePersona();

  const workspaces = useMemo(
    () => MOCK_WORKSPACES.filter((w) => canAccessLocation(persona, w.locationId, w.projectCode)),
    [persona],
  );
  const [wsIndex, setWsIndex] = useState(0);
  const ws = workspaces[wsIndex] ?? workspaces[0];
  const [subject, setSubject] = useState<SubjectType>("invoice");

  const stages = useMemo(
    () => (ws ? getApprovalTimeframes(ws.projectCode, subject) : []),
    [ws, subject],
  );
  const totalSla = stages.reduce((s, f) => s + f.slaDays, 0);

  // Confirmation flow: preview → confirm → added to the confirmed workflow list.
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmed, setConfirmed] = useState<ConfirmedWorkflow[]>([]);

  function confirmPreview() {
    if (!ws) return;
    setConfirmed((prev) => [
      {
        id: `${ws.locationId}-${subject}-${Date.now()}`,
        projectCode: ws.projectCode,
        projectName: ws.projectName,
        locationName: ws.locationName,
        subject,
        stageCount: stages.length,
        totalSla,
        confirmedAt: new Date().toLocaleString("id-ID", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
      },
      ...prev,
    ]);
    setConfirmOpen(false);
  }

  function removeConfirmed(id: string) {
    setConfirmed((prev) => prev.filter((c) => c.id !== id));
  }

  if (!ws) {
    return (
      <div>
        <PageHeader title="Master Timeframe" description="Konfigurasi timeframe approval per site." />
        <div className="p-6 text-sm text-muted-foreground">Tidak ada site dalam cakupan Anda.</div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Master Timeframe"
        description={`Timeframe default approval (config-driven) · ${ws.projectName} · ${ws.locationName}`}
        breadcrumbs={[{ label: "Master Data" }, { label: "Master Timeframe" }]}
      />

      <div className="space-y-6 p-4 md:p-6">
        <PersonaBanner persona={persona} scopeSummary={`${workspaces.length} site`} />

        <div className="flex flex-wrap items-center gap-3">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <label className="text-xs text-muted-foreground">Site</label>
          <select
            value={wsIndex}
            onChange={(e) => setWsIndex(Number(e.target.value))}
            className="h-8 rounded-md border bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-ring"
          >
            {workspaces.map((w, i) => (
              <option key={w.locationId} value={i}>
                {w.projectName} — {w.locationName} ({w.projectCode})
              </option>
            ))}
          </select>
          <div className="flex items-center gap-1.5 text-xs">
            {(["invoice", "daily_closing"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSubject(s)}
                className={
                  subject === s
                    ? "rounded-md border border-primary bg-primary px-2 py-1 text-[11px] font-medium text-primary-foreground"
                    : "rounded-md border border-input bg-background px-2 py-1 text-[11px] font-medium hover:bg-accent"
                }
              >
                {s === "invoice" ? "Invoice" : "Daily Closing"}
              </button>
            ))}
          </div>
          <Badge variant="info" className="ml-auto">
            Total SLA {totalSla} hari
          </Badge>
        </div>

        {/* Workflow preview (from mock/config data) */}
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <GitBranch className="h-4 w-4 text-primary" />
                  Pratinjau Workflow
                </CardTitle>
                <CardDescription>
                  Alur tahapan approval dengan SLA per tahap (data tiruan).
                </CardDescription>
              </div>
              <Button size="sm" onClick={() => setConfirmOpen(true)} className="gap-1.5">
                <CheckCircle2 className="h-4 w-4" />
                Konfirmasi Pratinjau
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Flow diagram */}
            <div className="flex flex-col items-stretch gap-3 md:flex-row md:items-center md:overflow-x-auto md:pb-2">
              {stages.map((s, i) => {
                const type = typeForStage(s.stage);
                return (
                  <div key={s.stage} className="flex items-center gap-3 md:shrink-0">
                    <div className="flex min-w-[170px] flex-col rounded-lg border bg-card p-3 shadow-sm">
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                          {i + 1}
                        </span>
                        <span className="text-sm font-medium">{s.stage}</span>
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          SLA {s.slaDays} hari
                        </span>
                        <Badge variant={type.variant}>{type.label}</Badge>
                      </div>
                      <div className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                        <User className="h-3 w-3" />
                        {roleForStage(s.stage)}
                      </div>
                    </div>
                    {i < stages.length - 1 && (
                      <ArrowRight className="hidden h-5 w-5 shrink-0 text-muted-foreground md:block" />
                    )}
                  </div>
                );
              })}
            </div>

            {/* SLA distribution bar */}
            <div className="mt-6">
              <div className="mb-1 text-xs font-medium text-muted-foreground">Distribusi SLA</div>
              <div className="flex h-6 overflow-hidden rounded-md border">
                {stages.map((s, i) => (
                  <div
                    key={s.stage}
                    className="flex items-center justify-center border-r text-[10px] text-white last:border-r-0"
                    style={{
                      width: `${totalSla > 0 ? (s.slaDays / totalSla) * 100 : 0}%`,
                      backgroundColor: `hsl(${210 - i * 25} 70% 55%)`,
                    }}
                    title={`${s.stage}: ${s.slaDays} hari`}
                  >
                    {s.slaDays}h
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-primary" />
              Timeframe — {ws.projectCode} · {subject === "invoice" ? "Invoice" : "Daily Closing"}
            </CardTitle>
            <CardDescription>{stages.length} tahapan approval berurutan.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="px-3 py-2 font-medium">#</th>
                    <th className="px-3 py-2 font-medium">Tahapan</th>
                    <th className="px-3 py-2 font-medium">Jenis</th>
                    <th className="px-3 py-2 font-medium">PIC</th>
                    <th className="px-3 py-2 text-right font-medium">SLA (hari)</th>
                  </tr>
                </thead>
                <tbody>
                  {stages.map((s, i) => {
                    const type = typeForStage(s.stage);
                    return (
                      <tr key={s.stage} className="border-b last:border-b-0">
                        <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                        <td className="px-3 py-2 font-medium">{s.stage}</td>
                        <td className="px-3 py-2">
                          <Badge variant={type.variant}>{type.label}</Badge>
                        </td>
                        <td className="px-3 py-2">
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <User className="h-3 w-3" />
                            {roleForStage(s.stage)}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <span className="inline-flex items-center gap-1 tabular-nums">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            {s.slaDays}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t">
                    <td colSpan={4} className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <FileCheck2 className="h-3 w-3" />
                        Total SLA
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">{totalSla} hari</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Confirmed workflow list */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-primary" />
              Daftar Workflow Terkonfirmasi
            </CardTitle>
            <CardDescription>
              {confirmed.length === 0
                ? "Belum ada workflow yang dikonfirmasi. Konfirmasi pratinjau untuk menambahkannya."
                : `${confirmed.length} workflow dikonfirmasi.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {confirmed.length === 0 ? (
              <div className="rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">
                Belum ada data.
              </div>
            ) : (
              <ul className="space-y-2">
                {confirmed.map((c) => (
                  <li
                    key={c.id}
                    className="flex flex-wrap items-center gap-3 rounded-md border bg-card px-3 py-2 text-sm"
                  >
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    <span className="font-medium">
                      {c.projectCode} · {c.locationName}
                    </span>
                    <Badge variant="info">{c.subject === "invoice" ? "Invoice" : "Daily Closing"}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {c.stageCount} tahap · SLA {c.totalSla} hari
                    </span>
                    <span className="text-xs text-muted-foreground">· {c.confirmedAt}</span>
                    <button
                      type="button"
                      onClick={() => removeConfirmed(c.id)}
                      className="ml-auto rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-rose-600"
                      aria-label="Hapus"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Konfirmasi Pratinjau Workflow"
        description="Tambahkan workflow yang sedang dipratinjau ke daftar terkonfirmasi."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setConfirmOpen(false)}>
              Batal
            </Button>
            <Button size="sm" onClick={confirmPreview} className="gap-1.5">
              <CheckCircle2 className="h-4 w-4" />
              Konfirmasi
            </Button>
          </div>
        }
      >
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Site</span>
            <span className="font-medium">
              {ws.projectName} — {ws.locationName}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Jenis Dokumen</span>
            <span className="font-medium">{subject === "invoice" ? "Invoice" : "Daily Closing"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Jumlah Tahapan</span>
            <span className="font-medium">{stages.length}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total SLA</span>
            <span className="font-medium">{totalSla} hari</span>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
