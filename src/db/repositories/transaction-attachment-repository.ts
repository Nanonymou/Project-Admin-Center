import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  transactionAttachments,
  type NewTransactionAttachment,
  type TransactionAttachment,
} from "@/db/schema";

/** List attachments for a daily transaction, oldest first. */
export async function listTransactionAttachments(
  transactionId: string,
): Promise<TransactionAttachment[]> {
  return db
    .select()
    .from(transactionAttachments)
    .where(eq(transactionAttachments.transactionId, transactionId))
    .orderBy(asc(transactionAttachments.createdAt));
}

/** Register a new transaction attachment (metadata + storage key). */
export async function addTransactionAttachment(
  values: NewTransactionAttachment,
): Promise<TransactionAttachment> {
  const [row] = await db.insert(transactionAttachments).values(values).returning();
  return row;
}

/** Delete an attachment by id. Returns true when a row was removed. */
export async function deleteTransactionAttachment(id: string): Promise<boolean> {
  const rows = await db
    .delete(transactionAttachments)
    .where(eq(transactionAttachments.id, id))
    .returning({ id: transactionAttachments.id });
  return rows.length > 0;
}
