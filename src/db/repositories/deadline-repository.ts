import { and, asc, eq, gte, lte, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { deadlines, type Deadline } from "@/db/schema";

export type DeadlineFilter = {
  /** Required for tenant scope; omit only for cross-site (executive) views. */
  projectId?: string;
  locationId?: string;
  kind?: string;
  status?: string;
  from?: string; // due date lower bound, YYYY-MM-DD
  to?: string; // due date upper bound, YYYY-MM-DD
  /** "tenant" enforces a project filter; "executive" allows cross-project. */
  scope?: "tenant" | "executive";
};

function buildWhere(filter: DeadlineFilter): SQL | undefined {
  const conds: SQL[] = [];
  // Multi-tenancy: never query without a project filter unless Executive scope.
  if (filter.scope !== "executive") {
    if (!filter.projectId) {
      throw new Error("projectId is required for tenant-scoped deadline queries");
    }
    conds.push(eq(deadlines.projectId, filter.projectId));
  } else if (filter.projectId) {
    conds.push(eq(deadlines.projectId, filter.projectId));
  }
  if (filter.locationId) conds.push(eq(deadlines.locationId, filter.locationId));
  if (filter.kind) conds.push(eq(deadlines.kind, filter.kind as Deadline["kind"]));
  if (filter.status) conds.push(eq(deadlines.status, filter.status as Deadline["status"]));
  if (filter.from) conds.push(gte(deadlines.dueDate, filter.from));
  if (filter.to) conds.push(lte(deadlines.dueDate, filter.to));
  return conds.length ? and(...conds) : undefined;
}

/**
 * List calendar deadlines for the filtered scope, ordered by due date.
 * Repository Pattern: all DB access to the deadlines table flows through this
 * module; multi-tenancy is enforced in `buildWhere`.
 */
export async function listDeadlines(filter: DeadlineFilter): Promise<Deadline[]> {
  const where = buildWhere(filter);
  return db.select().from(deadlines).where(where).orderBy(asc(deadlines.dueDate));
}

/**
 * Fetch a single deadline by id. Returns null when not found. Scope enforcement
 * is left to the caller (the row carries project_id/location_id for the check).
 */
export async function getDeadlineById(id: string): Promise<Deadline | null> {
  const [row] = await db.select().from(deadlines).where(eq(deadlines.id, id)).limit(1);
  return row ?? null;
}
