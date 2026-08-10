"use client";

import { useMemo, useRef, useState } from "react";
import {
  CalendarClock,
  MapPin,
  Clock,
  User,
  GitBranch,
  ChevronDown,
  ChevronRight,
  Upload,
  FileSpreadsheet,
} from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { usePersona } from "@/components/providers/persona-provider";
import { canAccessLocation, type Persona } from "@/lib/personas";
import { MOCK_WORKSPACES } from "@/lib/mock/workspaces";
import {
  buildWorkflowsForSite,
  workflowTotalSla,
  parseWorkflowActivities,
  SUBJECT_LABEL,
  type Workflow,
  type WorkflowSubject,
  type WorkflowParseResult,
} from "@/lib/mock/workflow-config";

/** Site admins/leaders can upload workflow timeframes; viewers are read-only. */
function canUpload(persona: Persona): boolean {
  return persona.role !== "viewer";
}

/**
 * Master Timeframe — workflow list per site (config-driven). Each workflow is an
 * ordered set of activities with an SLA and a PIC, derived from the approval
 * timeframe config so it stays consistent with SLA monitoring. Rows expand to
 * show the activity sequence. Persona-scoped; later tasks add Excel upload,
 * preview, and per-site active toggles on top of this list.
 */
export function MasterTimeframeClient() {
  const { persona } = usePersona();

  const workspaces = useMemo(
    () => MOCK_WORKSPACES.filter((w) => canAccessLocation(persona, w.locationId, w.projectCode)),
    [persona],
  );
  const [wsIndex, setWsIndex] = useState(0);
  const ws = workspaces[wsIndex] ?? workspaces[0];

  const workflows: Workflow[] = useMemo(
    () => (ws ? buildWorkflowsForSite(ws.locationId) : []),
    [ws],
  );

  const [expanded, setExpanded] = useState<string | null>(null);
  const editable = canUpload(persona);

  // Excel/CSV upload state.
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadSubject, setUploadSubject] = useState<WorkflowSubject>("invoice");
  const [pasteText, setPasteText] = useState("");
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState<WorkflowParseResult | null>(null);

  function openUpload() {
    setUploadSubject("invoice");
    setPasteText("");
    setFileName("");
    setParsed(null);
    setUploadOpen(true);
  }

  function onFile(file: File) {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => setPasteText(String(reader.result ?? ""));
    reader.readAsText(file);
  }

  function processUpload() {
    setParsed(parseWorkflowActivities(pasteText));
  }

  if (!ws) {
    return (
      <div>
        <PageHeader title="Master Timeframe" description="Daftar workflow per site." />
        <div className="p-6 text-sm text-muted-foreground">Tidak ada site dalam cakupan Anda.</div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Master Timeframe"
        description={`Daftar workflow (config-driven) · ${ws.projectName} · ${ws.locationName}`}
        breadcrumbs={[{ label: "Master Data" }, { label: "Master Timeframe" }]}
      />

      <div className="space-y-6 p-4 md:p-6">
        <PersonaBanner persona={persona} scopeSummary={`${workspaces.length} site`} />

        <div className="flex flex-wrap items-center gap-3">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <label className="text-xs text-muted-foreground">Site</label>
          <select
            value={wsIndex}
            onChange={(e) => {
              setWsIndex(Number(e.target.value));
              setExpanded(null);
            }}
            className="h-8 rounded-md border bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-ring"
          >
            {workspaces.map((w, i) => (
              <option key={w.locationId} value={i}>
                {w.projectName} — {w.locationName} ({w.projectCode})
              </option>
            ))}
          </select>
          <Badge variant="default" className="ml-auto gap-1">
            <GitBranch className="h-3 w-3" />
            {workflows.length} workflow
          </Badge>
          {editable && (
            <Button size="sm" onClick={openUpload} className="gap-1.5">
              <Upload className="h-4 w-4" />
              Unggah Excel
            </Button>
          )}
        </div>

        <div className="space-y-4">
          {workflows.map((wf) => {
            const isOpen = expanded === wf.id;
            const totalSla = workflowTotalSla(wf);
            return (
              <Card key={wf.id}>
                <CardHeader
                  className="cursor-pointer"
                  onClick={() => setExpanded(isOpen ? null : wf.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <CardTitle className="flex items-center gap-2 text-base">
                        {isOpen ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                        <CalendarClock className="h-4 w-4 text-primary" />
                        {SUBJECT_LABEL[wf.subject]}
                      </CardTitle>
                      <CardDescription className="mt-1 font-mono text-xs">{wf.code}</CardDescription>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <Badge variant="info" className="gap-1">
                        <GitBranch className="h-3 w-3" />
                        {wf.activities.length} aktivitas
                      </Badge>
                      <Badge variant="warning" className="gap-1">
                        <Clock className="h-3 w-3" />
                        {totalSla} hari SLA
                      </Badge>
                      <Badge variant={wf.active ? "success" : "muted"}>
                        {wf.active ? "Aktif" : "Nonaktif"}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                {isOpen && (
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[480px] text-sm">
                        <thead>
                          <tr className="border-b text-left text-xs text-muted-foreground">
                            <th className="px-3 py-2 font-medium">#</th>
                            <th className="px-3 py-2 font-medium">Aktivitas</th>
                            <th className="px-3 py-2 font-medium">PIC</th>
                            <th className="px-3 py-2 text-right font-medium">SLA</th>
                          </tr>
                        </thead>
                        <tbody>
                          {wf.activities.map((a) => (
                            <tr key={a.order} className="border-b last:border-b-0">
                              <td className="px-3 py-2 tabular-nums text-muted-foreground">{a.order + 1}</td>
                              <td className="px-3 py-2 font-medium">{a.name}</td>
                              <td className="px-3 py-2">
                                <Badge variant="secondary" className="gap-1">
                                  <User className="h-3 w-3" />
                                  {a.pic}
                                </Badge>
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums">{a.slaDays} hari</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      </div>

      <Dialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        title="Unggah Excel — Aktivitas Workflow"
        description="Unggah/paste data aktivitas dari Excel (CSV). Kolom: Aktivitas, PIC, SLA (hari)."
        className="max-w-lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setUploadOpen(false)}>
              Tutup
            </Button>
            <Button size="sm" onClick={processUpload} disabled={!pasteText.trim()}>
              Proses
            </Button>
          </div>
        }
      >
        <div className="space-y-3 text-sm">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Workflow tujuan</label>
            <select
              value={uploadSubject}
              onChange={(e) => setUploadSubject(e.target.value as WorkflowSubject)}
              className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              {(Object.keys(SUBJECT_LABEL) as WorkflowSubject[]).map((s) => (
                <option key={s} value={s}>
                  {SUBJECT_LABEL[s]}
                </option>
              ))}
            </select>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept=".csv,.tsv,.txt,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-input px-4 py-6 text-center transition hover:border-primary hover:bg-accent/40"
          >
            <FileSpreadsheet className="h-6 w-6 text-muted-foreground" />
            <span className="text-sm font-medium">Klik untuk memilih file CSV</span>
            {fileName && <span className="text-xs text-muted-foreground">{fileName}</span>}
          </button>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              atau tempel data (satu aktivitas per baris)
            </label>
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              rows={5}
              placeholder={"Verifikasi Site, Site Admin, 2\nApproval Leader, Leader Admin, 3"}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {parsed && (
            <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs">
              <span className="font-medium">{parsed.activities.length}</span> aktivitas terbaca
              {parsed.errorCount > 0 && (
                <span className="ml-1 text-rose-600">· {parsed.errorCount} baris bermasalah</span>
              )}
              . Pratinjau &amp; simpan tersedia pada langkah berikutnya.
            </div>
          )}
        </div>
      </Dialog>
    </div>
  );
}
