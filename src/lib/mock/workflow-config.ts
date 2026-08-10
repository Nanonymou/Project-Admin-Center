import { MOCK_WORKSPACES } from "@/lib/mock/workspaces";
import { getApprovalTimeframes } from "@/lib/mock/approval-timeframe-config";

/**
 * Workflow definitions (config-driven) for the Master Timeframe feature. A
 * workflow is an ordered sequence of activities — each with an SLA (days) and a
 * responsible PIC role — that a subject (invoice / daily closing) moves through
 * per site. Workflows are derived from the approval timeframe config so they
 * stay consistent with SLA monitoring, and are keyed by site. This is the
 * frontend-first mock the Master Timeframe pages drive until the workflow API
 * and Excel upload land.
 */

export type WorkflowSubject = "invoice" | "daily_closing";

export type WorkflowActivity = {
  order: number;
  name: string;
  slaDays: number;
  /** Responsible role for the activity. */
  pic: string;
};

export type Workflow = {
  id: string;
  code: string;
  name: string;
  subject: WorkflowSubject;
  projectCode: string;
  locationId: string;
  locationName: string;
  activities: WorkflowActivity[];
  active: boolean;
};

export const SUBJECT_LABEL: Record<WorkflowSubject, string> = {
  invoice: "Proses Invoice",
  daily_closing: "Daily Closing",
};

/** Default responsible role (PIC) for a stage name — mirrors the server resolver. */
export function picForStage(stage: string): string {
  const s = stage.toLowerCase();
  if (s.includes("site")) return "Site Admin";
  if (s.includes("leader")) return "Leader Admin";
  if (s.includes("finance")) return "Finance";
  if (s.includes("client")) return "Client";
  if (s.includes("payment")) return "Client";
  return "Site Admin";
}

function buildWorkflow(
  subject: WorkflowSubject,
  w: (typeof MOCK_WORKSPACES)[number],
): Workflow {
  const activities: WorkflowActivity[] = getApprovalTimeframes(w.projectCode, subject)
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((t) => ({ order: t.order, name: t.stage, slaDays: t.slaDays, pic: picForStage(t.stage) }));
  return {
    id: `wf-${w.locationId}-${subject}`,
    code: `${subject === "invoice" ? "INV" : "DC"}-${w.locationId.replace(/^loc-/, "").toUpperCase()}`,
    name: `${SUBJECT_LABEL[subject]} — ${w.locationName}`,
    subject,
    projectCode: w.projectCode,
    locationId: w.locationId,
    locationName: w.locationName,
    activities,
    active: true,
  };
}

/** All workflows configured for a site (one per subject type). */
export function buildWorkflowsForSite(locationId: string): Workflow[] {
  const w = MOCK_WORKSPACES.find((x) => x.locationId === locationId);
  if (!w) return [];
  return (["invoice", "daily_closing"] as WorkflowSubject[]).map((s) => buildWorkflow(s, w));
}

/** Total SLA (days) across a workflow's activities. */
export function workflowTotalSla(wf: Workflow): number {
  return wf.activities.reduce((sum, a) => sum + a.slaDays, 0);
}
