import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  systemParameters,
  systemParameterHistory,
  type SystemParameterRow,
  type SystemParameterHistoryRow,
} from "@/db/schema";

/**
 * System parameter (Parameter Sistem) data access. Repository Pattern: all DB
 * access to system_parameters / system_parameter_history flows through this
 * module. Values are stored as serialized text and coerced by the service layer.
 */

/** All parameter overrides present in the DB (config supplies the rest). */
export async function listSystemParameterOverrides(): Promise<SystemParameterRow[]> {
  return db.select().from(systemParameters);
}

/** Fetch a single parameter override by key, or undefined when unset. */
export async function getSystemParameterOverride(key: string): Promise<SystemParameterRow | undefined> {
  const [row] = await db.select().from(systemParameters).where(eq(systemParameters.key, key)).limit(1);
  return row;
}

/** Upsert a parameter's serialized value by its unique key. */
export async function upsertSystemParameter(
  key: string,
  value: string,
  changedBy?: string,
): Promise<void> {
  await db
    .insert(systemParameters)
    .values({ key, value, createdBy: changedBy })
    .onConflictDoUpdate({
      target: systemParameters.key,
      set: { value, updatedAt: new Date() },
    });
}

/** Append an immutable history entry recording a parameter change. */
export async function recordSystemParameterChange(entry: {
  key: string;
  beforeValue: string | null;
  afterValue: string;
  changedBy?: string;
}): Promise<void> {
  await db.insert(systemParameterHistory).values({
    key: entry.key,
    beforeValue: entry.beforeValue,
    afterValue: entry.afterValue,
    changedBy: entry.changedBy,
  });
}

/** Change history for one parameter (or all when key omitted), newest first. */
export async function listSystemParameterHistory(key?: string): Promise<SystemParameterHistoryRow[]> {
  const base = db.select().from(systemParameterHistory).orderBy(desc(systemParameterHistory.createdAt));
  if (key) {
    return db
      .select()
      .from(systemParameterHistory)
      .where(eq(systemParameterHistory.key, key))
      .orderBy(desc(systemParameterHistory.createdAt));
  }
  return base;
}
