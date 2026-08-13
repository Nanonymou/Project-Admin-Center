import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  masterLocks,
  masterVersions,
  type MasterLockRow,
  type MasterVersionRow,
} from "@/db/schema";

/**
 * Master Lock & Version Management data access. Repository Pattern: all DB access
 * to master_locks / master_versions flows through this module.
 */

export async function listMasterLocks(): Promise<MasterLockRow[]> {
  return db.select().from(masterLocks).orderBy(asc(masterLocks.category), asc(masterLocks.label));
}

export async function getMasterLock(entityKey: string): Promise<MasterLockRow | undefined> {
  const [row] = await db.select().from(masterLocks).where(eq(masterLocks.entityKey, entityKey)).limit(1);
  return row;
}

export type SeedLockInput = {
  entityKey: string;
  label: string;
  category: string;
  locked: boolean;
  version: number;
  lastModifiedBy?: string;
};

/** Upsert a lock row (used to seed/refresh the lockable-domain catalogue). */
export async function upsertMasterLock(input: SeedLockInput): Promise<void> {
  await db
    .insert(masterLocks)
    .values({
      entityKey: input.entityKey,
      label: input.label,
      category: input.category,
      locked: input.locked,
      version: input.version,
      lastModifiedBy: input.lastModifiedBy,
    })
    .onConflictDoUpdate({
      target: masterLocks.entityKey,
      set: { label: input.label, category: input.category, updatedAt: new Date() },
    });
}

/**
 * Set the lock state of a master domain. Returns the row after the change, or
 * undefined when the entity is unknown. Only toggles the flag — versioning is a
 * separate concern handled on committed edits.
 */
export async function setMasterLockState(
  entityKey: string,
  locked: boolean,
  actor?: string,
): Promise<MasterLockRow | undefined> {
  const existing = await getMasterLock(entityKey);
  if (!existing) return undefined;
  const [row] = await db
    .update(masterLocks)
    .set({ locked, lastModifiedBy: actor, lastModifiedAt: new Date(), updatedAt: new Date() })
    .where(eq(masterLocks.entityKey, entityKey))
    .returning();
  return row;
}

/** Is a master domain currently locked? Unknown domains are treated as unlocked. */
export async function isMasterLocked(entityKey: string): Promise<boolean> {
  const row = await getMasterLock(entityKey);
  return Boolean(row?.locked);
}

/**
 * Commit a new version for a master domain: bump the lock row's version and
 * append a non-destructive history entry. Returns the new version number, or
 * undefined when the entity is unknown.
 */
export async function commitMasterVersion(
  entityKey: string,
  summary: string,
  changedBy?: string,
): Promise<number | undefined> {
  return db.transaction(async (tx) => {
    const [existing] = await tx.select().from(masterLocks).where(eq(masterLocks.entityKey, entityKey)).limit(1);
    if (!existing) return undefined;
    const nextVersion = existing.version + 1;
    await tx
      .update(masterLocks)
      .set({ version: nextVersion, lastModifiedBy: changedBy, lastModifiedAt: new Date(), updatedAt: new Date() })
      .where(eq(masterLocks.entityKey, entityKey));
    await tx.insert(masterVersions).values({ entityKey, version: nextVersion, changedBy, summary });
    return nextVersion;
  });
}

/** Version history for a master domain, newest first. */
export async function listMasterVersions(entityKey: string): Promise<MasterVersionRow[]> {
  return db
    .select()
    .from(masterVersions)
    .where(eq(masterVersions.entityKey, entityKey))
    .orderBy(desc(masterVersions.version));
}
