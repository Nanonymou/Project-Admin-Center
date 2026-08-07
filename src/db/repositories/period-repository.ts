import { and, desc, eq, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { periodHistory, periods, type NewPeriodHistoryEntry, type Period } from "@/db/schema";

export type PeriodFilter = {
  /** Required for tenant scope; omit only for cross-site (executive) views. */
  projectId?: string;
  locationId?: string;
  status?: string;
  /** "tenant" enforces a project filter; "executive" allows cross-project. */
  scope?: "tenant" | "executive";
};

function buildWhere(filter: PeriodFilter): SQL | undefined {
  const conds: SQL[] = [];
  if (filter.scope !== "executive") {
    if (!filter.projectId) throw new Error("projectId is required for tenant-scoped period queries");
    conds.push(eq(periods.projectId, filter.projectId));
  } else if (filter.projectId) {
    conds.push(eq(periods.projectId, filter.projectId));
  }
  if (filter.locationId) conds.push(eq(periods.locationId, filter.locationId));
  if (filter.status) conds.push(eq(periods.status, filter.status as Period["status"]));
  return conds.length ? and(...conds) : undefined;
}

/**
 * List managed periods for the filtered scope, most recent window first.
 * Repository Pattern: all DB access to the periods table flows through here;
 * multi-tenancy is enforced in `buildWhere`.
 */
export async function listPeriods(filter: PeriodFilter): Promise<Period[]> {
  const where = buildWhere(filter);
  return db.select().from(periods).where(where).orderBy(desc(periods.periodStart));
}

/** Fetch a single period by id, or null. */
export async function getPeriodById(id: string): Promise<Period | null> {
  const [row] = await db.select().from(periods).where(eq(periods.id, id)).limit(1);
  return row ?? null;
}

/** Append a period history entry. */
export async function addPeriodHistory(entry: NewPeriodHistoryEntry): Promise<void> {
  await db.insert(periodHistory).values(entry);
}
