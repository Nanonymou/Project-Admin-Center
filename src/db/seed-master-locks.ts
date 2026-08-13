import { db } from "@/db";
import { masterLocks } from "@/db/schema";
import { listMasterEntities } from "@/lib/mock/master-lock";

export type MasterLockSeedResult = { entities: number };

/**
 * Seed the lockable master-data domains from the config catalogue
 * (`listMasterEntities`). Idempotent: each entity is upserted by its unique key,
 * refreshing its label/category/version without clobbering a live lock toggle on
 * re-run (the lock flag is only set on first insert).
 */
export async function seedMasterLocks(): Promise<MasterLockSeedResult> {
  const entities = listMasterEntities();
  for (const e of entities) {
    await db
      .insert(masterLocks)
      .values({
        entityKey: e.key,
        label: e.label,
        category: e.category,
        locked: e.locked,
        version: e.version,
        lastModifiedBy: e.lastModifiedBy,
        createdBy: "seed",
      })
      .onConflictDoUpdate({
        target: masterLocks.entityKey,
        set: { label: e.label, category: e.category, updatedAt: new Date() },
      });
  }
  return { entities: entities.length };
}
