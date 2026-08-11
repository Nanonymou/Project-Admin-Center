import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { invoiceLines, type InvoiceLine, type NewInvoiceLine } from "@/db/schema";

/** List an invoice's live (non-recycled) line items, in display order. */
export async function listInvoiceLines(invoiceId: string): Promise<InvoiceLine[]> {
  return db
    .select()
    .from(invoiceLines)
    .where(and(eq(invoiceLines.invoiceId, invoiceId), isNull(invoiceLines.deletedAt)))
    .orderBy(asc(invoiceLines.lineOrder));
}

/** Insert a single invoice line. */
export async function addInvoiceLine(values: NewInvoiceLine): Promise<InvoiceLine> {
  const [row] = await db.insert(invoiceLines).values(values).returning();
  return row;
}

/**
 * Replace all of an invoice's line items in one transaction — deletes the
 * existing rows and inserts the supplied set. Keeps the detail's line list and
 * the invoice atomic so a partial save can't leave orphaned lines.
 */
export async function replaceInvoiceLines(
  invoiceId: string,
  lines: NewInvoiceLine[],
): Promise<InvoiceLine[]> {
  return db.transaction(async (tx) => {
    await tx.delete(invoiceLines).where(eq(invoiceLines.invoiceId, invoiceId));
    if (lines.length === 0) return [];
    return tx.insert(invoiceLines).values(lines).returning();
  });
}
