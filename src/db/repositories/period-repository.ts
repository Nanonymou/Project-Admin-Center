import { and, desc, eq, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { periodHistory, periods, type NewPeriodHistoryEntry, type Period } from "@/db/schema";

export type PeriodStatusValue = Period["status"];
export type PeriodActionValue =
  | "open"
  | "start_closing"
  | "close"
  | "lock"
  | "unlock"
  | "reopen";

export type PeriodFilter = {
  /** Required for tenant scope; omit only for cross-site (executive) views. */
  projectId?: string;
  locationId?: string;
  status?: string;
  /** "tenant" enforces a project filter; "executive" allows cross-project. */
  scope?: "tenant" | "executive";
};

function buildWhere(filter: PeriodFilter): SQL | undefined {
  const conds: SQL[] = [];
  if (filter.scope !== "executive") {
    if (!filter.projectId) throw new Error("projectId is required for tenant-scoped period queries");
    conds.push(eq(periods.projectId, filter.projectId));
  } else if (filter.projectId) {
    conds.push(eq(periods.projectId, filter.projectId));
  }
  if (filter.locationId) conds.push(eq(periods.locationId, filter.locationId));
  if (filter.status) conds.push(eq(periods.status, filter.status as Period["status"]));
  return conds.length ? and(...conds) : undefined;
}

/**
 * List managed periods for the filtered scope, most recent window first.
 * Repository Pattern: all DB access to the periods table flows through here;
 * multi-tenancy is enforced in `buildWhere`.
 */
export async function listPeriods(filter: PeriodFilter): Promise<Period[]> {
  const where = buildWhere(filter);
  return db.select().from(periods).where(where).orderBy(desc(periods.periodStart));
}

/** Fetch a single period by id, or null. */
export async function getPeriodById(id: string): Promise<Period | null> {
  const [row] = await db.select().from(periods).where(eq(periods.id, id)).limit(1);
  return row ?? null;
}

/** Append a period history entry. */
export async function addPeriodHistory(entry: NewPeriodHistoryEntry): Promise<void> {
  await db.insert(periodHistory).values(entry);
}

export type SetPeriodStatusInput = {
  projectId: string;
  locationId: string;
  periodLabel: string;
  periodType?: string;
  periodStart?: string;
  periodEnd?: string;
  status: PeriodStatusValue;
  action: PeriodActionValue;
  actor: string;
  note?: string;
};

/**
 * Transition a period to a new status (upsert) and append a matching history
 * entry, atomically. Returns the updated period row.
 */
export async function setPeriodStatus(input: SetPeriodStatusInput): Promise<Period> {
  return db.transaction(async (tx) => {
    const [period] = await tx
      .insert(periods)
      .values({
        projectId: input.projectId,
        locationId: input.locationId,
        periodLabel: input.periodLabel,
        periodType: input.periodType,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        status: input.status,
        createdBy: input.actor,
      })
      .onConflictDoUpdate({
        target: [periods.projectId, periods.locationId, periods.periodLabel],
        set: {
          status: input.status,
          periodType: input.periodType,
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
          updatedAt: new Date(),
        },
      })
      .returning();

    await tx.insert(periodHistory).values({
      periodId: period.id,
      projectId: input.projectId,
      locationId: input.locationId,
      action: input.action,
      actor: input.actor,
      note: input.note,
    });

    return period;
  });
}
