import type { Persona } from "@/lib/personas";
import { insertActivityLog } from "@/db/repositories/activity-log-repository";

/**
 * Automatic user-activity recorder (Activity Log feature). A thin, best-effort
 * helper endpoints call to log what a persona just did — the operational feed
 * behind `/activity-log`. It never throws: a logging failure (e.g. DB
 * unavailable) must not break the primary operation, so all errors are
 * swallowed. Distinct from the audit-log writer, which records system/security
 * events.
 */

export type ActivityAction =
  | "create"
  | "edit"
  | "submit"
  | "review"
  | "approve"
  | "reject"
  | "lock"
  | "unlock"
  | "upload"
  | "send";

export type RecordActivityInput = {
  action: ActivityAction;
  target: string;
  projectCode?: string | null;
  locationId?: string | null;
  detail?: string;
};

/**
 * Record an activity performed by a persona. Best-effort — resolves whether or
 * not the write succeeds.
 */
export async function recordActivity(persona: Persona, input: RecordActivityInput): Promise<void> {
  try {
    await insertActivityLog({
      action: input.action,
      actor: persona.name,
      role: persona.roleLabel,
      target: input.target,
      projectCode: input.projectCode ?? null,
      locationId: input.locationId ?? null,
      detail: input.detail ?? "",
    });
  } catch {
    // best-effort — never block the primary operation on activity logging
  }
}
