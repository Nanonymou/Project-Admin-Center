"use client";

import { useMemo, useState } from "react";
import { CalendarClock, Clock, MapPin, User, FileCheck2 } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePersona } from "@/components/providers/persona-provider";
import { canAccessLocation } from "@/lib/personas";
import { MOCK_WORKSPACES } from "@/lib/mock/workspaces";
import { getApprovalTimeframes } from "@/lib/mock/approval-timeframe-config";

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
      </div>
    </div>
  );
}
