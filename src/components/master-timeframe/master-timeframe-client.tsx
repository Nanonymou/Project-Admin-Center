"use client";

import { useMemo, useState } from "react";
import { CalendarClock, MapPin, Clock, User, GitBranch, ChevronDown, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePersona } from "@/components/providers/persona-provider";
import { canAccessLocation } from "@/lib/personas";
import { MOCK_WORKSPACES } from "@/lib/mock/workspaces";
import {
  buildWorkflowsForSite,
  workflowTotalSla,
  SUBJECT_LABEL,
  type Workflow,
} from "@/lib/mock/workflow-config";

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
    </div>
  );
}
