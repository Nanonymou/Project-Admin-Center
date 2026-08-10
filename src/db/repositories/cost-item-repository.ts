import { and, desc, eq, isNull, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { costItems, type CostItem, type NewCostItem } from "@/db/schema";

export type CostItemFilter = {
  projectId?: string;
  locationId?: string;
  batchId?: string;
  scope?: "tenant" | "executive";
  limit?: number;
};

/** Tenant-safe WHERE builder — throws for a tenant query without a projectId. */
function buildWhere(filter: CostItemFilter): SQL | undefined {
  const conds: SQL[] = [isNull(costItems.deletedAt)];
  if (filter.scope !== "executive") {
    if (!filter.projectId) throw new Error("projectId is required for tenant-scoped cost-item queries");
    conds.push(eq(costItems.projectId, filter.projectId));
  } else if (filter.projectId) {
    conds.push(eq(costItems.projectId, filter.projectId));
  }
  if (filter.locationId) conds.push(eq(costItems.locationId, filter.locationId));
  if (filter.batchId) conds.push(eq(costItems.batchId, filter.batchId));
  return and(...conds);
}

/** List cost items (excludes soft-deleted), newest first. */
export async function listCostItems(filter: CostItemFilter): Promise<CostItem[]> {
  const limit = Math.min(Math.max(filter.limit ?? 200, 1), 1000);
  return db
    .select()
    .from(costItems)
    .where(buildWhere(filter))
    .orderBy(desc(costItems.createdAt))
    .limit(limit);
}

/** Fetch one cost item by id (excludes soft-deleted). */
export async function getCostItemById(id: string): Promise<CostItem | null> {
  const [row] = await db
    .select()
    .from(costItems)
    .where(and(eq(costItems.id, id), isNull(costItems.deletedAt)))
    .limit(1);
  return row ?? null;
}

/** Create a cost item. Returns the created row. */
export async function createCostItem(values: NewCostItem): Promise<CostItem> {
  const [row] = await db.insert(costItems).values(values).returning();
  return row;
}

/** Update a cost item's editable fields. Tenant-scoped by projectId. */
export async function updateCostItem(
  id: string,
  projectId: string,
  patch: Partial<Pick<NewCostItem, "categoryKey" | "label" | "qty" | "unitPrice" | "amount" | "note">>,
): Promise<CostItem | null> {
  const [row] = await db
    .update(costItems)
    .set({ ...patch, updatedAt: new Date() })
    .where(
      and(eq(costItems.id, id), eq(costItems.projectId, projectId), isNull(costItems.deletedAt)),
    )
    .returning();
  return row ?? null;
}

/** Soft-delete a cost item. */
export async function softDeleteCostItem(id: string, projectId: string, actor: string): Promise<boolean> {
  const [row] = await db
    .update(costItems)
    .set({ deletedAt: new Date(), deletedBy: actor })
    .where(
      and(eq(costItems.id, id), eq(costItems.projectId, projectId), isNull(costItems.deletedAt)),
    )
    .returning();
  return Boolean(row);
}
