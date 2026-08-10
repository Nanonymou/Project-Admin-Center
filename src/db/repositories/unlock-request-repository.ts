import { and, desc, eq, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { unlockRequests, type UnlockRequest, type NewUnlockRequest } from "@/db/schema";

export type UnlockRequestFilter = {
  projectId?: string;
  locationId?: string;
  periodLabel?: string;
  status?: "pending" | "approved" | "rejected";
  limit?: number;
};

/** List unlock requests, newest first. */
export async function listUnlockRequests(filter: UnlockRequestFilter): Promise<UnlockRequest[]> {
  const conds: SQL[] = [];
  if (filter.projectId) conds.push(eq(unlockRequests.projectId, filter.projectId));
  if (filter.locationId) conds.push(eq(unlockRequests.locationId, filter.locationId));
  if (filter.periodLabel) conds.push(eq(unlockRequests.periodLabel, filter.periodLabel));
  if (filter.status) conds.push(eq(unlockRequests.status, filter.status));
  const limit = Math.min(Math.max(filter.limit ?? 100, 1), 500);
  return db
    .select()
    .from(unlockRequests)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(unlockRequests.createdAt))
    .limit(limit);
}

/** Create an unlock request. Returns the created row. */
export async function createUnlockRequest(values: NewUnlockRequest): Promise<UnlockRequest> {
  const [row] = await db.insert(unlockRequests).values(values).returning();
  return row;
}

/** Record an approved (or rejected) unlock decision as a request row. */
export async function recordUnlockDecision(values: NewUnlockRequest): Promise<UnlockRequest> {
  const [row] = await db
    .insert(unlockRequests)
    .values({ ...values, reviewedAt: new Date() })
    .returning();
  return row;
}
