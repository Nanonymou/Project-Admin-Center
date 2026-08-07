import { and, desc, eq, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  backups,
  restoreHistory,
  type Backup,
  type NewBackup,
  type NewRestoreHistoryEntry,
  type RestoreHistoryEntry,
} from "@/db/schema";

export type BackupFilter = {
  projectId?: string;
  status?: string;
  limit?: number;
};

/** List backups, newest first, optionally filtered by project/status. */
export async function listBackups(filter: BackupFilter = {}): Promise<Backup[]> {
  const conds: SQL[] = [];
  if (filter.projectId) conds.push(eq(backups.projectId, filter.projectId));
  if (filter.status) conds.push(eq(backups.status, filter.status as Backup["status"]));
  const limit = Math.min(Math.max(filter.limit ?? 100, 1), 500);
  return db
    .select()
    .from(backups)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(backups.createdAt))
    .limit(limit);
}

/** Fetch a backup by id, or null. */
export async function getBackupById(id: string): Promise<Backup | null> {
  const [row] = await db.select().from(backups).where(eq(backups.id, id)).limit(1);
  return row ?? null;
}

/** Insert a backup record. */
export async function createBackup(values: NewBackup): Promise<Backup> {
  const [row] = await db.insert(backups).values(values).returning();
  return row;
}

/** List restore history, newest first, optionally for one backup. */
export async function listRestoreHistory(backupId?: string, limit = 100): Promise<RestoreHistoryEntry[]> {
  const capped = Math.min(Math.max(limit, 1), 500);
  return db
    .select()
    .from(restoreHistory)
    .where(backupId ? eq(restoreHistory.backupId, backupId) : undefined)
    .orderBy(desc(restoreHistory.createdAt))
    .limit(capped);
}

/** Insert a restore history record. */
export async function createRestore(values: NewRestoreHistoryEntry): Promise<RestoreHistoryEntry> {
  const [row] = await db.insert(restoreHistory).values(values).returning();
  return row;
}
