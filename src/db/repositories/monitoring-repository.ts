import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  storageMetrics,
  userActivity,
  type NewStorageMetric,
  type NewUserActivity,
  type StorageMetric,
} from "@/db/schema";

export type PersonaActivity = {
  personaId: string;
  lastAction: string;
  lastSeen: string;
  count: number;
};

/**
 * Latest activity per persona — the most recent action and timestamp plus the
 * total activity count. Used to derive each user's current status.
 */
export async function latestActivityPerPersona(): Promise<PersonaActivity[]> {
  const rows = await db
    .select({
      personaId: userActivity.personaId,
      lastSeen: sql<string>`max(${userActivity.createdAt})`,
      count: sql<number>`count(*)`,
    })
    .from(userActivity)
    .groupBy(userActivity.personaId);

  // Fetch the most recent action label per persona.
  const result: PersonaActivity[] = [];
  for (const r of rows) {
    const [latest] = await db
      .select({ action: userActivity.action })
      .from(userActivity)
      .where(eq(userActivity.personaId, r.personaId))
      .orderBy(desc(userActivity.createdAt))
      .limit(1);
    result.push({
      personaId: r.personaId,
      lastAction: latest?.action ?? "",
      lastSeen: String(r.lastSeen),
      count: Number(r.count),
    });
  }
  return result;
}

/** Record a user activity event. */
export async function writeUserActivity(entry: NewUserActivity): Promise<void> {
  await db.insert(userActivity).values(entry);
}

/** Latest storage metric snapshot per category (optionally per project). */
export async function latestStorageMetrics(projectId?: string): Promise<StorageMetric[]> {
  const rows = await db
    .select()
    .from(storageMetrics)
    .where(projectId ? eq(storageMetrics.projectId, projectId) : undefined)
    .orderBy(desc(storageMetrics.capturedAt))
    .limit(200);
  // Keep only the newest row per (project, category).
  const seen = new Set<string>();
  const out: StorageMetric[] = [];
  for (const r of rows) {
    const key = `${r.projectId ?? ""}|${r.category}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

/** Record a storage metric snapshot. */
export async function writeStorageMetric(entry: NewStorageMetric): Promise<void> {
  await db.insert(storageMetrics).values(entry);
}
