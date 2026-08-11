import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { invoiceTypes, type InvoiceType, type NewInvoiceType } from "@/db/schema";

/**
 * Invoice type (Jenis Invoice) data access. Repository Pattern: all DB access to
 * invoice_types flows through this module.
 */
export async function listInvoiceTypes(activeOnly = false): Promise<InvoiceType[]> {
  const q = db.select().from(invoiceTypes).orderBy(asc(invoiceTypes.code));
  const rows = await q;
  return activeOnly ? rows.filter((r) => r.active) : rows;
}

/** Upsert an invoice type by its unique code. */
export async function upsertInvoiceType(values: NewInvoiceType): Promise<void> {
  await db
    .insert(invoiceTypes)
    .values(values)
    .onConflictDoUpdate({
      target: invoiceTypes.code,
      set: {
        label: values.label,
        deductionRate: values.deductionRate,
        hasBbm: values.hasBbm,
        bbmRate: values.bbmRate,
        projectCode: values.projectCode,
        active: values.active ?? true,
        updatedAt: new Date(),
      },
    });
}

/** Activate/deactivate an invoice type by code. */
export async function setInvoiceTypeActive(code: string, active: boolean): Promise<void> {
  await db
    .update(invoiceTypes)
    .set({ active, updatedAt: new Date() })
    .where(eq(invoiceTypes.code, code));
}
