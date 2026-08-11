import type { Persona } from "@/lib/personas";
import { writeAuditLog } from "@/db/repositories/audit-log-repository";

/**
 * Automatic data-change recorder (Audit Log feature). A thin, best-effort helper
 * that config/master endpoints call after a change, capturing the before/after
 * values into audit_logs so the Audit Log page can show an old-vs-new comparison.
 * Never throws — a logging failure must not roll back the primary change. This is
 * the change-oriented counterpart to the operational activity recorder.
 */

export type RecordChangeInput = {
  category: string;
  action: string;
  entityType: string;
  entityId: string;
  /** Human-readable summary of the change. */
  detail?: string;
  /** Previous value (null/undefined for create events). */
  before?: string | number | boolean | null;
  /** New value (null/undefined for pure state toggles). */
  after?: string | number | boolean | null;
  projectId?: string | null;
  locationId?: string | null;
};

function toStr(v: string | number | boolean | null | undefined): string | null {
  if (v === null || v === undefined) return null;
  return String(v);
}

/**
 * Record a data change to the audit log, including its before/after values.
 * Best-effort: resolves whether or not the write succeeds.
 */
export async function recordDataChange(persona: Persona, input: RecordChangeInput): Promise<void> {
  try {
    await writeAuditLog({
      projectId: input.projectId ?? undefined,
      locationId: input.locationId ?? undefined,
      category: input.category,
      action: input.action,
      actor: persona.name,
      entityType: input.entityType,
      entityId: input.entityId,
      detail: input.detail ?? "",
      beforeValue: toStr(input.before),
      afterValue: toStr(input.after),
    });
  } catch {
    // best-effort — never block the primary change on audit logging
  }
}
