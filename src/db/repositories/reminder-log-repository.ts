import { and, desc, eq, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { reminderLogs, type ReminderLogRow, type NewReminderLogRow } from "@/db/schema";

/**
 * Reminder log data access. Repository Pattern: all DB access to reminder_logs
 * flows through this module. Append-only.
 */

export async function insertReminderLogs(entries: NewReminderLogRow[]): Promise<number> {
  if (entries.length === 0) return 0;
  await db.insert(reminderLogs).values(entries);
  return entries.length;
}

export type ReminderLogFilter = { projectCode?: string; locationId?: string; limit?: number };

/** List dispatched reminders, newest first. */
export async function listReminderLogs(filter: ReminderLogFilter = {}): Promise<ReminderLogRow[]> {
  const conds: SQL[] = [];
  if (filter.projectCode) conds.push(eq(reminderLogs.projectCode, filter.projectCode));
  if (filter.locationId) conds.push(eq(reminderLogs.locationId, filter.locationId));

  const rows = await db
    .select()
    .from(reminderLogs)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(reminderLogs.sentAt));

  return filter.limit && filter.limit > 0 ? rows.slice(0, filter.limit) : rows;
}
