"use client";

import { useMemo, useState } from "react";
import { GitBranch, ArrowRight, Clock } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PersonaBanner } from "@/components/activity/persona-banner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePersona } from "@/components/providers/persona-provider";
import { canAccessProject } from "@/lib/personas";
import { MOCK_WORKSPACES } from "@/lib/mock/workspaces";
import { getApprovalTimeframes } from "@/lib/mock/approval-timeframe-config";

type SubjectType = "invoice" | "daily_closing";

/**
 * Workflow Default Approval — a visual diagram of the config-driven default
 * approval workflow (the ordered stages + SLA per stage) for a project and
 * subject type. Renders the flow as connected stage nodes. Persona-scoped;
 * reads stages from the shared approval-timeframe config (no project-named
 * branches).
 */
export function WorkflowApprovalClient() {
  const { persona } = usePersona();

  const projects = useMemo(() => {
    const codes = Array.from(new Set(MOCK_WORKSPACES.map((w) => w.projectCode)));
    return codes.filter((c) => canAccessProject(persona, c));
  }, [persona]);

  const [project, setProject] = useState(projects[0] ?? "");
  const [subject, setSubject] = useState<SubjectType>("invoice");

  const stages = useMemo(
    () => (project ? getApprovalTimeframes(project, subject) : []),
    [project, subject],
  );
  const totalSla = stages.reduce((s, f) => s + f.slaDays, 0);

  if (projects.length === 0) {
    return (
      <div>
        <PageHeader title="Workflow Default Approval" description="Alur default approval." />
        <div className="p-6 text-sm text-muted-foreground">Tidak ada project dalam cakupan Anda.</div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Workflow Default Approval"
        description="Visualisasi alur default persetujuan (config-driven) per project & jenis dokumen."
        breadcrumbs={[{ label: "Master Data" }, { label: "Workflow Default Approval" }]}
      />

      <div className="space-y-6 p-4 md:p-6">
        <PersonaBanner persona={persona} scopeSummary={`${projects.length} project`} />

        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs text-muted-foreground">Project</label>
          <select
            value={project}
            onChange={(e) => setProject(e.target.value)}
            className="h-8 rounded-md border bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-ring"
          >
            {projects.map((p) => (
              <option key={p} value={p}>
                {p}
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
              <GitBranch className="h-4 w-4 text-primary" />
              Alur Persetujuan — {project} · {subject === "invoice" ? "Invoice" : "Daily Closing"}
            </CardTitle>
            <CardDescription>{stages.length} stage berurutan.</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Flow diagram */}
            <div className="flex flex-col items-stretch gap-3 md:flex-row md:items-center md:overflow-x-auto md:pb-2">
              {stages.map((s, i) => (
                <div key={s.stage} className="flex items-center gap-3 md:shrink-0">
                  <div className="flex min-w-[160px] flex-col rounded-lg border bg-card p-3 shadow-sm">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                        {i + 1}
                      </span>
                      <span className="text-sm font-medium">{s.stage}</span>
                    </div>
                    <div className="mt-2 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      SLA {s.slaDays} hari
                    </div>
                  </div>
                  {i < stages.length - 1 && (
                    <ArrowRight className="hidden h-5 w-5 shrink-0 text-muted-foreground md:block" />
                  )}
                </div>
              ))}
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
      </div>
    </div>
  );
}
