import { canAccessLocation, type Persona } from "@/lib/personas";
import { SITE_KPI } from "@/lib/mock/site-kpi";
import { SITE_DETAILS } from "@/lib/mock/site-detail";
import { buildApprovalReminders } from "@/lib/mock/approvals";
import { insertApprovals, listApprovals } from "@/db/repositories/approval-repository";
import type { NewApproval } from "@/db/schema";

/**
 * Lazily populate the DB approval queue the first time it is accessed. Each mock
 * approval reminder (deterministic id `${locationId}-${invoiceNumber}`) becomes
 * one persisted `approvals` row keyed by that id as `subject_id`, so the client's
 * queue items map 1:1 to real DB rows and transitions can be recorded. Idempotent:
 * a reminder whose subject_id already exists is skipped, so it never duplicates.
 */
export async function ensureApprovalRows(persona: Persona): Promise<void> {
  const sites = SITE_KPI.filter((s) => canAccessLocation(persona, s.locationId, s.projectCode));
  if (sites.length === 0) return;

  const existing = await listApprovals({ scope: "executive" });
  const existingKeys = new Set(existing.map((a) => a.subjectId));

  const toInsert: NewApproval[] = [];
  for (const s of sites) {
    const detail = SITE_DETAILS[s.locationId];
    if (!detail) continue;
    for (const r of buildApprovalReminders(s, detail)) {
      if (existingKeys.has(r.id)) continue;
      existingKeys.add(r.id);
      toInsert.push({
        subjectType: "invoice",
        subjectId: r.id,
        currentStage: r.stage,
        status: r.status === "approved" ? "approved" : "in_progress",
        assignedTo: r.assignee,
        projectId: s.projectCode,
        locationId: s.locationId,
      });
    }
  }
  if (toInsert.length > 0) await insertApprovals(toInsert);
}
