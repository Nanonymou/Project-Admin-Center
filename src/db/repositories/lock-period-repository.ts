import { and, desc, eq, gte, lte, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  dailyTransactions,
  lockPeriods,
  lockPeriodHistory,
  type LockPeriod,
  type LockPeriodHistory,
} from "@/db/schema";

export type LockPeriodFilter = {
  projectId?: string;
  locationId?: string;
  locked?: boolean;
  scope?: "tenant" | "executive";
  limit?: number;
};

/**
 * List period-lock rows (the current lock status per site/period), newest first.
 * Tenant scope requires a projectId; executive scope may span projects.
 */
export async function listLockPeriods(filter: LockPeriodFilter): Promise<LockPeriod[]> {
  const conds: SQL[] = [];
  if (filter.scope !== "executive") {
    if (!filter.projectId) throw new Error("projectId is required for tenant-scoped lock queries");
    conds.push(eq(lockPeriods.projectId, filter.projectId));
  } else if (filter.projectId) {
    conds.push(eq(lockPeriods.projectId, filter.projectId));
  }
  if (filter.locationId) conds.push(eq(lockPeriods.locationId, filter.locationId));
  if (filter.locked !== undefined) conds.push(eq(lockPeriods.locked, filter.locked));
  const limit = Math.min(Math.max(filter.limit ?? 200, 1), 1000);
  return db
    .select()
    .from(lockPeriods)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(lockPeriods.periodLabel))
    .limit(limit);
}

/** Append a lock/unlock action to the period-lock history. */
export async function recordLockHistory(entry: {
  projectId: string;
  locationId: string;
  periodLabel: string;
  action: "lock" | "unlock";
  actor: string;
  reason?: string;
}): Promise<void> {
  await db.insert(lockPeriodHistory).values(entry);
}

/** List the lock/unlock history for a site/period (or scope), newest first. */
export async function listLockHistory(filter: {
  projectId?: string;
  locationId?: string;
  periodLabel?: string;
  limit?: number;
}): Promise<LockPeriodHistory[]> {
  const conds: SQL[] = [];
  if (filter.projectId) conds.push(eq(lockPeriodHistory.projectId, filter.projectId));
  if (filter.locationId) conds.push(eq(lockPeriodHistory.locationId, filter.locationId));
  if (filter.periodLabel) conds.push(eq(lockPeriodHistory.periodLabel, filter.periodLabel));
  const limit = Math.min(Math.max(filter.limit ?? 100, 1), 500);
  return db
    .select()
    .from(lockPeriodHistory)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(lockPeriodHistory.createdAt))
    .limit(limit);
}

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

/**
 * Whether a given transaction date falls inside a locked period for the site.
 * Used to validate transaction mutations — a locked period rejects new/edited
 * entries. A lock row with missing bounds does not match a specific date.
 */
export async function isPeriodLocked(
  projectId: string,
  locationId: string,
  trxDate: string,
): Promise<boolean> {
  const rows = await db
    .select({ id: lockPeriods.id })
    .from(lockPeriods)
    .where(
      and(
        eq(lockPeriods.projectId, projectId),
        eq(lockPeriods.locationId, locationId),
        eq(lockPeriods.locked, true),
        lte(lockPeriods.periodStart, trxDate),
        gte(lockPeriods.periodEnd, trxDate),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

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
