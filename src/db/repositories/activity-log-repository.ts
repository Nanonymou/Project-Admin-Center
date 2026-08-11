import { and, desc, eq, gte, lte, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { activityLogs, type ActivityLogRow, type NewActivityLogRow } from "@/db/schema";

/**
 * Activity Log data access. Repository Pattern: all DB access to activity_logs
 * flows through this module. The table is append-only.
 */

export async function insertActivityLog(entry: NewActivityLogRow): Promise<void> {
  await db.insert(activityLogs).values(entry);
}

/** Fetch a single activity log entry by id, or undefined. */
export async function getActivityLogById(id: string): Promise<ActivityLogRow | undefined> {
  const [row] = await db.select().from(activityLogs).where(eq(activityLogs.id, id)).limit(1);
  return row;
}

export type ActivityLogFilter = {
  projectCode?: string;
  locationId?: string;
  actor?: string;
  action?: string;
  from?: string; // ISO
  to?: string; // ISO
  limit?: number;
};

/** List activity log entries matching the filter, newest first. */
export async function listActivityLogs(filter: ActivityLogFilter = {}): Promise<ActivityLogRow[]> {
  const conds: SQL[] = [];
  if (filter.projectCode) conds.push(eq(activityLogs.projectCode, filter.projectCode));
  if (filter.locationId) conds.push(eq(activityLogs.locationId, filter.locationId));
  if (filter.actor) conds.push(eq(activityLogs.actor, filter.actor));
  if (filter.action) conds.push(eq(activityLogs.action, filter.action));
  if (filter.from) conds.push(gte(activityLogs.createdAt, new Date(filter.from)));
  if (filter.to) conds.push(lte(activityLogs.createdAt, new Date(filter.to)));

  const rows = await db
    .select()
    .from(activityLogs)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(activityLogs.createdAt));

  return filter.limit && filter.limit > 0 ? rows.slice(0, filter.limit) : rows;
}
