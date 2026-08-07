import { and, asc, eq, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { masterTimeframes, type MasterTimeframe, type NewMasterTimeframe } from "@/db/schema";

export type TimeframeFilter = {
  projectCode: string;
  subjectType?: string;
  activeOnly?: boolean;
};

/**
 * List master approval timeframes (stage SLAs) for a project, ordered by stage
 * order. Repository Pattern: all DB access to master_timeframes flows through
 * this module.
 */
export async function listMasterTimeframes(filter: TimeframeFilter): Promise<MasterTimeframe[]> {
  const conds: SQL[] = [eq(masterTimeframes.projectCode, filter.projectCode)];
  if (filter.subjectType) conds.push(eq(masterTimeframes.subjectType, filter.subjectType));
  if (filter.activeOnly) conds.push(eq(masterTimeframes.active, true));
  return db
    .select()
    .from(masterTimeframes)
    .where(and(...conds))
    .orderBy(asc(masterTimeframes.subjectType), asc(masterTimeframes.orderIndex));
}

/** Upsert a master timeframe by (projectCode, subjectType, stage). */
export async function upsertMasterTimeframe(values: NewMasterTimeframe): Promise<void> {
  await db
    .insert(masterTimeframes)
    .values(values)
    .onConflictDoUpdate({
      target: [masterTimeframes.projectCode, masterTimeframes.subjectType, masterTimeframes.stage],
      set: {
        slaDays: values.slaDays,
        orderIndex: values.orderIndex,
        active: true,
        updatedAt: new Date(),
      },
    });
}
