import { and, asc, eq, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { masterPrices, type MasterPrice, type NewMasterPrice } from "@/db/schema";

export type MasterPriceFilter = {
  projectCode: string;
  locationId?: string;
  categoryKey?: string;
  activeOnly?: boolean;
};

/**
 * List per-location master prices for a project, optionally narrowed by location
 * or category. Repository Pattern: all DB access to the master_prices table
 * flows through this module.
 */
export async function listMasterPrices(filter: MasterPriceFilter): Promise<MasterPrice[]> {
  const conds: SQL[] = [eq(masterPrices.projectCode, filter.projectCode)];
  if (filter.locationId) conds.push(eq(masterPrices.locationId, filter.locationId));
  if (filter.categoryKey) conds.push(eq(masterPrices.categoryKey, filter.categoryKey));
  if (filter.activeOnly) conds.push(eq(masterPrices.active, true));
  return db
    .select()
    .from(masterPrices)
    .where(and(...conds))
    .orderBy(asc(masterPrices.locationId), asc(masterPrices.categoryKey));
}

/** Upsert one per-location price by (projectCode, locationId, categoryKey). */
export async function upsertMasterPrice(values: NewMasterPrice): Promise<void> {
  await db
    .insert(masterPrices)
    .values(values)
    .onConflictDoUpdate({
      target: [masterPrices.projectCode, masterPrices.locationId, masterPrices.categoryKey],
      set: {
        price: values.price,
        effectiveFrom: values.effectiveFrom,
        active: values.active,
        updatedAt: new Date(),
      },
    });
}

/** Bulk upsert a set of per-location prices in one transaction. */
export async function upsertMasterPrices(values: NewMasterPrice[]): Promise<number> {
  if (values.length === 0) return 0;
  await db.transaction(async (tx) => {
    for (const v of values) {
      await tx
        .insert(masterPrices)
        .values(v)
        .onConflictDoUpdate({
          target: [masterPrices.projectCode, masterPrices.locationId, masterPrices.categoryKey],
          set: { price: v.price, effectiveFrom: v.effectiveFrom, active: v.active, updatedAt: new Date() },
        });
    }
  });
  return values.length;
}
