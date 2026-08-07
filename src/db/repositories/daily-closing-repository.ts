import { and, asc, desc, eq, gte, lte, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  dailyClosingHistory,
  dailyClosings,
  type DailyClosing,
  type DailyClosingHistoryEntry,
  type NewDailyClosingHistoryEntry,
} from "@/db/schema";

export type ClosingFilter = {
  projectId?: string;
  locationId?: string;
  status?: string;
  from?: string; // closing_date lower bound
  to?: string; // closing_date upper bound
  limit?: number;
  scope?: "tenant" | "executive";
};

function buildWhere(filter: ClosingFilter): SQL | undefined {
  const conds: SQL[] = [];
  if (filter.scope !== "executive") {
    if (!filter.projectId) throw new Error("projectId is required for tenant-scoped closing queries");
    conds.push(eq(dailyClosings.projectId, filter.projectId));
  } else if (filter.projectId) {
    conds.push(eq(dailyClosings.projectId, filter.projectId));
  }
  if (filter.locationId) conds.push(eq(dailyClosings.locationId, filter.locationId));
  if (filter.status) conds.push(eq(dailyClosings.status, filter.status as DailyClosing["status"]));
  if (filter.from) conds.push(gte(dailyClosings.closingDate, filter.from));
  if (filter.to) conds.push(lte(dailyClosings.closingDate, filter.to));
  return conds.length ? and(...conds) : undefined;
}

/** List daily closings for the filtered scope, newest date first. */
export async function listDailyClosings(filter: ClosingFilter): Promise<DailyClosing[]> {
  const where = buildWhere(filter);
  const limit = Math.min(Math.max(filter.limit ?? 200, 1), 1000);
  return db
    .select()
    .from(dailyClosings)
    .where(where)
    .orderBy(desc(dailyClosings.closingDate))
    .limit(limit);
}

/** Fetch a single closing by id, or null. */
export async function getDailyClosingById(id: string): Promise<DailyClosing | null> {
  const [row] = await db.select().from(dailyClosings).where(eq(dailyClosings.id, id)).limit(1);
  return row ?? null;
}

/** Fetch a closing together with its chronological history, or null. */
export async function getDailyClosingWithHistory(
  id: string,
): Promise<{ closing: DailyClosing; history: DailyClosingHistoryEntry[] } | null> {
  const closing = await getDailyClosingById(id);
  if (!closing) return null;
  const history = await db
    .select()
    .from(dailyClosingHistory)
    .where(eq(dailyClosingHistory.closingId, id))
    .orderBy(asc(dailyClosingHistory.createdAt));
  return { closing, history };
}

/** Append a closing history entry. */
export async function addDailyClosingHistory(entry: NewDailyClosingHistoryEntry): Promise<void> {
  await db.insert(dailyClosingHistory).values(entry);
}

export type ClosingHistoryFilter = {
  closingId?: string;
  projectId?: string;
  locationId?: string;
  limit?: number;
  scope?: "tenant" | "executive";
};

/**
 * List closing history entries, newest first — for a single closing or a site's
 * recent status changes. Tenant-scoped: a query without a closingId and not in
 * executive scope requires a projectId.
 */
export async function listClosingHistory(
  filter: ClosingHistoryFilter,
): Promise<DailyClosingHistoryEntry[]> {
  const conds: SQL[] = [];
  if (filter.closingId) conds.push(eq(dailyClosingHistory.closingId, filter.closingId));
  if (filter.scope !== "executive" && !filter.closingId) {
    if (!filter.projectId) throw new Error("projectId is required for tenant-scoped history queries");
    conds.push(eq(dailyClosingHistory.projectId, filter.projectId));
  } else if (filter.projectId) {
    conds.push(eq(dailyClosingHistory.projectId, filter.projectId));
  }
  if (filter.locationId) conds.push(eq(dailyClosingHistory.locationId, filter.locationId));

  const limit = Math.min(Math.max(filter.limit ?? 100, 1), 500);
  return db
    .select()
    .from(dailyClosingHistory)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(dailyClosingHistory.createdAt))
    .limit(limit);
}

export type ClosingStatusValue = DailyClosing["status"];
export type ClosingActionValue = "open" | "submit" | "approve" | "reject" | "lock" | "reopen";

export type SetClosingStatusInput = {
  projectId: string;
  locationId: string;
  closingDate: string;
  status: ClosingStatusValue;
  action: ClosingActionValue;
  actor: string;
  note?: string;
};

/**
 * Transition a day's closing to a new status (upsert on project+location+date)
 * and append a matching history entry, atomically. Sets the relevant actor /
 * timestamp columns for submit / approve / lock. Returns the updated closing.
 */
export async function setClosingStatus(input: SetClosingStatusInput): Promise<DailyClosing> {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(dailyClosings)
      .where(
        and(
          eq(dailyClosings.projectId, input.projectId),
          eq(dailyClosings.locationId, input.locationId),
          eq(dailyClosings.closingDate, input.closingDate),
        ),
      )
      .limit(1);
    const fromStatus = existing?.status ?? null;

    const now = new Date();
    const submitFields = input.action === "submit" ? { submittedBy: input.actor, submittedAt: now } : {};
    const approveFields = input.action === "approve" ? { approvedBy: input.actor, approvedAt: now } : {};
    const lockFields = input.action === "lock" ? { lockedAt: now } : {};

    const [closing] = await tx
      .insert(dailyClosings)
      .values({
        projectId: input.projectId,
        locationId: input.locationId,
        closingDate: input.closingDate,
        status: input.status,
        note: input.note,
        createdBy: input.actor,
        ...submitFields,
        ...approveFields,
        ...lockFields,
      })
      .onConflictDoUpdate({
        target: [dailyClosings.projectId, dailyClosings.locationId, dailyClosings.closingDate],
        set: {
          status: input.status,
          note: input.note,
          updatedAt: now,
          ...submitFields,
          ...approveFields,
          ...lockFields,
        },
      })
      .returning();

    await tx.insert(dailyClosingHistory).values({
      closingId: closing.id,
      projectId: input.projectId,
      locationId: input.locationId,
      action: input.action,
      fromStatus,
      toStatus: input.status,
      actor: input.actor,
      note: input.note,
    });

    return closing;
  });
}
