import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { numberSequences } from "@/db/schema";

/**
 * Running-sequence data access for the Automatic Number Generator. Repository
 * Pattern: all DB access to number_sequences flows through this module.
 */

/**
 * Atomically claim and return the next sequence value for a (docType, period)
 * bucket. Runs in a transaction: reads the current counter (seeding it from
 * `startSeq` the first time the bucket is seen), hands out that value, and
 * advances the stored counter by one — so concurrent callers never receive the
 * same number and there are no gaps within a bucket.
 */
export async function claimNextSequence(
  docType: string,
  periodKey: string,
  startSeq = 1,
): Promise<number> {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(numberSequences)
      .where(and(eq(numberSequences.docType, docType), eq(numberSequences.periodKey, periodKey)))
      .limit(1);

    const current = existing ? existing.nextSeq : Math.max(1, startSeq);

    if (existing) {
      await tx
        .update(numberSequences)
        .set({ nextSeq: current + 1, updatedAt: new Date() })
        .where(and(eq(numberSequences.docType, docType), eq(numberSequences.periodKey, periodKey)));
    } else {
      await tx.insert(numberSequences).values({ docType, periodKey, nextSeq: current + 1 });
    }
    return current;
  });
}

/** Peek at the next sequence value without claiming it (falls back to startSeq). */
export async function peekNextSequence(
  docType: string,
  periodKey: string,
  startSeq = 1,
): Promise<number> {
  const [existing] = await db
    .select()
    .from(numberSequences)
    .where(and(eq(numberSequences.docType, docType), eq(numberSequences.periodKey, periodKey)))
    .limit(1);
  return existing ? existing.nextSeq : Math.max(1, startSeq);
}
