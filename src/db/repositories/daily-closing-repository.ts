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
