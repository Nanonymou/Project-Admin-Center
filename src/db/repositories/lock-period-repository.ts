import { and, eq, gte, lte } from "drizzle-orm";
import { db } from "@/db";
import { dailyTransactions, lockPeriods, type LockPeriod } from "@/db/schema";

export type SetLockInput = {
  projectId: string;
  locationId: string;
  periodLabel: string;
  periodStart?: string; // YYYY-MM-DD
  periodEnd?: string; // YYYY-MM-DD
  locked: boolean;
  actor: string;
  reason?: string;
};

/** Fetch the lock row for a site + period, or null. */
export async function getLockPeriod(
  projectId: string,
  locationId: string,
  periodLabel: string,
): Promise<LockPeriod | null> {
  const [row] = await db
    .select()
    .from(lockPeriods)
    .where(
      and(
        eq(lockPeriods.projectId, projectId),
        eq(lockPeriods.locationId, locationId),
        eq(lockPeriods.periodLabel, periodLabel),
      ),
    )
    .limit(1);
  return row ?? null;
}

/**
 * Set a period's lock state (upsert). Records who locked/unlocked it and when.
 * Repository Pattern: all DB access to lock_periods flows through this module.
 */
export async function setPeriodLock(input: SetLockInput): Promise<LockPeriod> {
  const now = input.locked ? new Date() : null;
  const [row] = await db
    .insert(lockPeriods)
    .values({
      projectId: input.projectId,
      locationId: input.locationId,
      periodLabel: input.periodLabel,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      locked: input.locked,
      lockedBy: input.locked ? input.actor : null,
      lockedAt: now,
      reason: input.reason,
      createdBy: input.actor,
    })
    .onConflictDoUpdate({
      target: [lockPeriods.projectId, lockPeriods.locationId, lockPeriods.periodLabel],
      set: {
        locked: input.locked,
        lockedBy: input.locked ? input.actor : null,
        lockedAt: now,
        reason: input.reason,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        updatedAt: new Date(),
      },
    })
    .returning();
  return row;
}

/**
 * Cascade a lock/unlock to the daily transactions within the period window:
 * locking sets rows to "locked"; unlocking reopens locked rows to "submitted".
 * Returns the number of affected rows. When bounds are missing, no rows change.
 */
export async function applyLockToTransactions(input: {
  projectId: string;
  locationId: string;
  from?: string;
  to?: string;
  locked: boolean;
}): Promise<number> {
  if (!input.from || !input.to) return 0;
  const rangeCond = and(
    eq(dailyTransactions.projectId, input.projectId),
    eq(dailyTransactions.locationId, input.locationId),
    gte(dailyTransactions.trxDate, input.from),
    lte(dailyTransactions.trxDate, input.to),
  );

  if (input.locked) {
    const rows = await db
      .update(dailyTransactions)
      .set({ status: "locked", lockedAt: new Date(), updatedAt: new Date() })
      .where(rangeCond)
      .returning({ id: dailyTransactions.id });
    return rows.length;
  }

  const rows = await db
    .update(dailyTransactions)
    .set({ status: "submitted", lockedAt: null, updatedAt: new Date() })
    .where(and(rangeCond, eq(dailyTransactions.status, "locked")))
    .returning({ id: dailyTransactions.id });
  return rows.length;
}
