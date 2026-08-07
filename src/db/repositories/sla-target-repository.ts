import { and, eq, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { slaTargets, type SlaTarget, type NewSlaTarget } from "@/db/schema";

export type SlaTargetFilter = {
  projectCode?: string;
  subjectType?: "invoice" | "daily_closing";
  activeOnly?: boolean;
};

/** List SLA approval targets. Config-driven, keyed by project_code. */
export async function listSlaTargets(filter: SlaTargetFilter = {}): Promise<SlaTarget[]> {
  const conds: SQL[] = [];
  if (filter.projectCode) conds.push(eq(slaTargets.projectCode, filter.projectCode));
  if (filter.subjectType) conds.push(eq(slaTargets.subjectType, filter.subjectType));
  if (filter.activeOnly) conds.push(eq(slaTargets.active, true));
  return db
    .select()
    .from(slaTargets)
    .where(conds.length ? and(...conds) : undefined);
}

/** Upsert one SLA target (unique per project_code + subject_type). */
export async function upsertSlaTarget(values: NewSlaTarget): Promise<void> {
  await db
    .insert(slaTargets)
    .values(values)
    .onConflictDoUpdate({
      target: [slaTargets.projectCode, slaTargets.subjectType],
      set: {
        targetDays: values.targetDays,
        atRiskPct: values.atRiskPct,
        breachGraceDays: values.breachGraceDays,
        active: values.active,
        updatedAt: new Date(),
      },
    });
}
