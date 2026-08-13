import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { numberFormats, type NumberFormatRow, type NewNumberFormatRow } from "@/db/schema";

/**
 * Automatic Number Generator format data access. Repository Pattern: all DB
 * access to number_formats flows through this module. The running counters live
 * in number_sequences and are managed by the generator service, not here.
 */

export async function listNumberFormats(activeOnly = false): Promise<NumberFormatRow[]> {
  const rows = await db.select().from(numberFormats).orderBy(asc(numberFormats.label));
  return activeOnly ? rows.filter((r) => r.active) : rows;
}

export async function getNumberFormat(key: string): Promise<NumberFormatRow | undefined> {
  const [row] = await db.select().from(numberFormats).where(eq(numberFormats.key, key)).limit(1);
  return row;
}

/** Upsert a number format by its unique key. */
export async function upsertNumberFormat(values: NewNumberFormatRow): Promise<void> {
  await db
    .insert(numberFormats)
    .values(values)
    .onConflictDoUpdate({
      target: numberFormats.key,
      set: {
        docType: values.docType,
        label: values.label,
        prefix: values.prefix,
        pattern: values.pattern,
        seqPadding: values.seqPadding,
        resetPeriod: values.resetPeriod,
        active: values.active ?? true,
        updatedAt: new Date(),
      },
    });
}

/** Activate/deactivate a number format by key. Returns false when absent. */
export async function setNumberFormatActive(key: string, active: boolean): Promise<boolean> {
  const existing = await getNumberFormat(key);
  if (!existing) return false;
  await db.update(numberFormats).set({ active, updatedAt: new Date() }).where(eq(numberFormats.key, key));
  return true;
}
