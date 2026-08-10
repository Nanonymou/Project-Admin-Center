import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  danaCashAttachments,
  type DanaCashAttachment,
  type NewDanaCashAttachment,
} from "@/db/schema";

/** List attachments for a Dana Cash transaction, newest first. */
export async function listDanaCashAttachments(transactionId: string): Promise<DanaCashAttachment[]> {
  return db
    .select()
    .from(danaCashAttachments)
    .where(eq(danaCashAttachments.transactionId, transactionId))
    .orderBy(desc(danaCashAttachments.createdAt));
}

/** Fetch one Dana Cash attachment by id. */
export async function getDanaCashAttachmentById(id: string): Promise<DanaCashAttachment | null> {
  const [row] = await db
    .select()
    .from(danaCashAttachments)
    .where(eq(danaCashAttachments.id, id))
    .limit(1);
  return row ?? null;
}

/** Record a Dana Cash attachment. Returns the created row. */
export async function createDanaCashAttachment(
  values: NewDanaCashAttachment,
): Promise<DanaCashAttachment> {
  const [row] = await db.insert(danaCashAttachments).values(values).returning();
  return row;
}

/** Delete a Dana Cash attachment (hard delete; attachments have no soft-delete). */
export async function deleteDanaCashAttachment(id: string, projectId: string): Promise<boolean> {
  const [row] = await db
    .delete(danaCashAttachments)
    .where(and(eq(danaCashAttachments.id, id), eq(danaCashAttachments.projectId, projectId)))
    .returning();
  return Boolean(row);
}
