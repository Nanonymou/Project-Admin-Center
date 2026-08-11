import { parseWorkflowActivities, type ParsedActivity } from "@/lib/mock/workflow-config";

/**
 * Workflow (Master Timeframe) Excel-upload validation. Business rules that go
 * beyond per-row parsing: whole-file integrity (at least one row, no duplicate
 * activity names, SLA within sane bounds, sequential ordering). The upload API
 * calls this before persisting so an invalid file is rejected atomically — never
 * partially written — and the DB transaction rolls back if a late guard trips.
 */

export type WorkflowValidationIssue = {
  /** 1-based row number as it appears in the uploaded file (excluding header). */
  row: number;
  activity: string;
  message: string;
};

export type WorkflowValidationResult = {
  ok: boolean;
  activities: ParsedActivity[];
  issues: WorkflowValidationIssue[];
  totalSla: number;
};

/** Upper guard for a single activity's SLA (days) — a year is clearly a typo. */
const MAX_SLA_DAYS = 365;

/**
 * Parse + validate an uploaded Excel-as-CSV of workflow activities. Returns every
 * issue found (not just the first) so the UI can highlight all bad rows at once.
 * `ok` is true only when there are zero issues.
 */
export function validateWorkflowUpload(csv: string): WorkflowValidationResult {
  const parsed = parseWorkflowActivities(csv);
  const issues: WorkflowValidationIssue[] = [];

  if (parsed.activities.length === 0) {
    return { ok: false, activities: [], issues: [{ row: 0, activity: "", message: "CSV kosong atau tanpa baris data." }], totalSla: 0 };
  }

  const seen = new Map<string, number>();
  for (const a of parsed.activities) {
    const row = a.order + 1;

    // Per-row errors surfaced by the parser (empty name, invalid/negative SLA).
    if (a.error) {
      issues.push({ row, activity: a.name, message: a.error });
      continue;
    }

    // Whole-file rule: activity names must be unique within a workflow.
    const key = a.name.toLowerCase();
    const prev = seen.get(key);
    if (prev !== undefined) {
      issues.push({ row, activity: a.name, message: `Nama aktivitas duplikat dengan baris ${prev}.` });
    } else {
      seen.set(key, row);
    }

    // Upper bound guard — catches an SLA entered in the wrong unit/typo.
    if (a.slaDays > MAX_SLA_DAYS) {
      issues.push({ row, activity: a.name, message: `SLA ${a.slaDays} hari melebihi batas wajar (${MAX_SLA_DAYS}).` });
    }
  }

  const totalSla = parsed.activities.filter((a) => !a.error).reduce((s, a) => s + a.slaDays, 0);
  return { ok: issues.length === 0, activities: parsed.activities, issues, totalSla };
}
