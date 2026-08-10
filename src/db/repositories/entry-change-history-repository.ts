import { and, desc, eq, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  entryChangeHistory,
  type EntryChangeHistory,
  type NewEntryChangeHistory,
} from "@/db/schema";

export type EntryChangeFilter = {
  projectId?: string;
  locationId?: string;
  kind?: "sales" | "cost";
  transactionId?: string;
  trxDate?: string;
  scope?: "tenant" | "executive";
  limit?: number;
};

/** Tenant-safe WHERE builder — throws for a tenant query without a projectId. */
function buildWhere(filter: EntryChangeFilter): SQL | undefined {
  const conds: SQL[] = [];
  if (filter.scope !== "executive") {
    if (!filter.projectId) throw new Error("projectId is required for tenant-scoped change history");
    conds.push(eq(entryChangeHistory.projectId, filter.projectId));
  } else if (filter.projectId) {
    conds.push(eq(entryChangeHistory.projectId, filter.projectId));
  }
  if (filter.locationId) conds.push(eq(entryChangeHistory.locationId, filter.locationId));
  if (filter.kind) conds.push(eq(entryChangeHistory.kind, filter.kind));
  if (filter.transactionId) conds.push(eq(entryChangeHistory.transactionId, filter.transactionId));
  if (filter.trxDate) conds.push(eq(entryChangeHistory.trxDate, filter.trxDate));
  return conds.length ? and(...conds) : undefined;
}

/** List entry change-history rows, newest change first. */
export async function listEntryChangeHistory(
  filter: EntryChangeFilter,
): Promise<EntryChangeHistory[]> {
  const limit = Math.min(Math.max(filter.limit ?? 200, 1), 1000);
  return db
    .select()
    .from(entryChangeHistory)
    .where(buildWhere(filter))
    .orderBy(desc(entryChangeHistory.createdAt))
    .limit(limit);
}

/** Append one change-history row. Returns the created row. */
export async function recordEntryChange(values: NewEntryChangeHistory): Promise<EntryChangeHistory> {
  const [row] = await db.insert(entryChangeHistory).values(values).returning();
  return row;
}
