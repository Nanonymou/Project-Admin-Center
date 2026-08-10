import { and, asc, desc, eq, isNull, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  danaCashAudit,
  danaCashTransactions,
  type DanaCashAudit,
  type DanaCashTransaction,
  type NewDanaCashTransaction,
} from "@/db/schema";

export type DanaCashFilter = {
  projectId?: string;
  locationId?: string;
  scope?: "tenant" | "executive";
  limit?: number;
};

function buildWhere(filter: DanaCashFilter): SQL | undefined {
  const conds: SQL[] = [isNull(danaCashTransactions.deletedAt)];
  if (filter.scope !== "executive") {
    if (!filter.projectId) throw new Error("projectId is required for tenant-scoped dana-cash queries");
    conds.push(eq(danaCashTransactions.projectId, filter.projectId));
  } else if (filter.projectId) {
    conds.push(eq(danaCashTransactions.projectId, filter.projectId));
  }
  if (filter.locationId) conds.push(eq(danaCashTransactions.locationId, filter.locationId));
  return and(...conds);
}

/** List Dana Cash transactions (excludes soft-deleted), oldest first for a ledger. */
export async function listDanaCashTransactions(
  filter: DanaCashFilter,
): Promise<DanaCashTransaction[]> {
  const limit = Math.min(Math.max(filter.limit ?? 500, 1), 2000);
  return db
    .select()
    .from(danaCashTransactions)
    .where(buildWhere(filter))
    .orderBy(asc(danaCashTransactions.trxDate), asc(danaCashTransactions.createdAt))
    .limit(limit);
}

/** Fetch one Dana Cash transaction by id (excludes soft-deleted). */
export async function getDanaCashTransactionById(id: string): Promise<DanaCashTransaction | null> {
  const [row] = await db
    .select()
    .from(danaCashTransactions)
    .where(and(eq(danaCashTransactions.id, id), isNull(danaCashTransactions.deletedAt)))
    .limit(1);
  return row ?? null;
}

/** List the audit trail (change history) for a Dana Cash transaction, newest first. */
export async function listDanaCashAudit(transactionId: string): Promise<DanaCashAudit[]> {
  return db
    .select()
    .from(danaCashAudit)
    .where(eq(danaCashAudit.transactionId, transactionId))
    .orderBy(desc(danaCashAudit.createdAt));
}

/** Signed amount for a movement (top-up positive, expense negative). */
function signedAmount(direction: "top_up" | "expense", amount: number): number {
  return direction === "top_up" ? amount : -amount;
}

/** Create a Dana Cash transaction and record a "create" audit entry. */
export async function createDanaCashTransaction(
  values: NewDanaCashTransaction,
  actor: string,
): Promise<DanaCashTransaction> {
  return db.transaction(async (tx) => {
    const [row] = await tx.insert(danaCashTransactions).values(values).returning();
    await tx.insert(danaCashAudit).values({
      transactionId: row.id,
      projectId: row.projectId,
      locationId: row.locationId,
      action: "create",
      beforeAmount: null,
      afterAmount: signedAmount(row.direction, Number(row.amount)).toFixed(2),
      actor,
      detail: `Transaksi kas ${row.direction} dibuat.`,
    });
    return row;
  });
}

/** Update a Dana Cash transaction and record an "update" audit entry. */
export async function updateDanaCashTransaction(
  id: string,
  projectId: string,
  patch: Partial<Pick<NewDanaCashTransaction, "trxDate" | "direction" | "categoryKey" | "description" | "amount">>,
  actor: string,
): Promise<DanaCashTransaction | null> {
  return db.transaction(async (tx) => {
    const [prev] = await tx
      .select()
      .from(danaCashTransactions)
      .where(
        and(
          eq(danaCashTransactions.id, id),
          eq(danaCashTransactions.projectId, projectId),
          isNull(danaCashTransactions.deletedAt),
        ),
      )
      .limit(1);
    if (!prev) return null;

    const [row] = await tx
      .update(danaCashTransactions)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(danaCashTransactions.id, id))
      .returning();

    await tx.insert(danaCashAudit).values({
      transactionId: id,
      projectId: row.projectId,
      locationId: row.locationId,
      action: "update",
      beforeAmount: signedAmount(prev.direction, Number(prev.amount)).toFixed(2),
      afterAmount: signedAmount(row.direction, Number(row.amount)).toFixed(2),
      actor,
      detail: "Transaksi kas diubah.",
    });
    return row;
  });
}

/** Soft-delete a Dana Cash transaction and record a "delete" audit entry. */
export async function softDeleteDanaCashTransaction(
  id: string,
  projectId: string,
  actor: string,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(danaCashTransactions)
      .set({ deletedAt: new Date(), deletedBy: actor })
      .where(
        and(
          eq(danaCashTransactions.id, id),
          eq(danaCashTransactions.projectId, projectId),
          isNull(danaCashTransactions.deletedAt),
        ),
      )
      .returning();
    if (!row) return false;
    await tx.insert(danaCashAudit).values({
      transactionId: id,
      projectId: row.projectId,
      locationId: row.locationId,
      action: "delete",
      beforeAmount: signedAmount(row.direction, Number(row.amount)).toFixed(2),
      afterAmount: null,
      actor,
      detail: "Transaksi kas dihapus.",
    });
    return true;
  });
}
