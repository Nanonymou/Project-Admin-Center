import { and, desc, eq, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { masterPriceHistory, type MasterPriceHistoryRow, type NewMasterPriceHistoryRow } from "@/db/schema";

/**
 * Master Pricing Engine change-history data access. Repository Pattern: all DB
 * access to master_price_history flows through this module. History is
 * append-only — entries are never updated or deleted.
 */

export async function recordMasterPriceChange(entry: NewMasterPriceHistoryRow): Promise<void> {
  await db.insert(masterPriceHistory).values(entry);
}

export type MasterPriceHistoryFilter = {
  projectCode: string;
  locationId?: string;
  categoryKey?: string;
  limit?: number;
};

/** List the price-change trail for a site (optionally one category), newest first. */
export async function listMasterPriceHistory(
  filter: MasterPriceHistoryFilter,
): Promise<MasterPriceHistoryRow[]> {
  const conds: SQL[] = [eq(masterPriceHistory.projectCode, filter.projectCode)];
  if (filter.locationId) conds.push(eq(masterPriceHistory.locationId, filter.locationId));
  if (filter.categoryKey) conds.push(eq(masterPriceHistory.categoryKey, filter.categoryKey));

  const rows = await db
    .select()
    .from(masterPriceHistory)
    .where(and(...conds))
    .orderBy(desc(masterPriceHistory.createdAt));

  return filter.limit && filter.limit > 0 ? rows.slice(0, filter.limit) : rows;
}
