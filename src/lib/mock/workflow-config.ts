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

// --- Excel/CSV upload parsing --------------------------------------------

export type ParsedActivity = {
  order: number;
  name: string;
  slaDays: number;
  pic: string;
  /** Non-empty when the row failed validation; kept so the UI can show it. */
  error?: string;
};

export type WorkflowParseResult = {
  activities: ParsedActivity[];
  errorCount: number;
};

const HEADER_HINT = /aktivitas|activity|stage|tahap/i;

/**
 * Parse pasted/uploaded Excel-exported CSV text into staged workflow activities.
 * Expected columns: `Aktivitas, PIC, SLA (hari)`. A header row is auto-detected
 * and skipped. Each row is validated (non-empty name, SLA ≥ 0); invalid rows are
 * returned with an `error` so the preview can flag them before saving. Frontend
 * only — no file leaves the browser.
 */
export function parseWorkflowActivities(text: string): WorkflowParseResult {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length > 0 && HEADER_HINT.test(lines[0])) lines.shift();

  const activities: ParsedActivity[] = [];
  let errorCount = 0;

  lines.forEach((line, i) => {
    // Support comma or semicolon (Excel-in-ID often uses `;`).
    const cols = line.split(/[;,\t]/).map((c) => c.trim());
    const name = cols[0] ?? "";
    const pic = cols[1] ?? "";
    const slaRaw = cols[2] ?? "";
    const slaDays = Number(slaRaw);

    let error: string | undefined;
    if (!name) error = "Nama aktivitas kosong";
    else if (slaRaw === "" || Number.isNaN(slaDays)) error = "SLA tidak valid";
    else if (slaDays < 0) error = "SLA tidak boleh negatif";

    if (error) errorCount++;
    activities.push({
      order: i,
      name,
      slaDays: Number.isNaN(slaDays) ? 0 : slaDays,
      pic: pic || picForStage(name),
      error,
    });
  });

  return { activities, errorCount };
}
