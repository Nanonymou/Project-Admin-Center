import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { invoiceAttachments, type InvoiceAttachment, type NewInvoiceAttachment } from "@/db/schema";

/** List attachments for an invoice, oldest first. */
export async function listAttachments(invoiceId: string): Promise<InvoiceAttachment[]> {
  return db
    .select()
    .from(invoiceAttachments)
    .where(eq(invoiceAttachments.invoiceId, invoiceId))
    .orderBy(asc(invoiceAttachments.createdAt));
}

/** Fetch a single attachment by id, or null. */
export async function getAttachmentById(id: string): Promise<InvoiceAttachment | null> {
  const [row] = await db
    .select()
    .from(invoiceAttachments)
    .where(eq(invoiceAttachments.id, id))
    .limit(1);
  return row ?? null;
}

/** Register a new invoice attachment (metadata + storage key). */
export async function addAttachment(values: NewInvoiceAttachment): Promise<InvoiceAttachment> {
  const [row] = await db.insert(invoiceAttachments).values(values).returning();
  return row;
}

/** Delete an attachment by id. Returns true when a row was removed. */
export async function deleteAttachment(id: string): Promise<boolean> {
  const rows = await db
    .delete(invoiceAttachments)
    .where(eq(invoiceAttachments.id, id))
    .returning({ id: invoiceAttachments.id });
  return rows.length > 0;
}
