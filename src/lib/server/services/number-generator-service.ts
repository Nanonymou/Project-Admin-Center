import { getNumberFormat } from "@/db/repositories/number-format-repository";
import { claimNextSequence, peekNextSequence } from "@/db/repositories/number-sequence-repository";
import { listNumberFormats as listConfigFormats, generateSample, type NumberFormat } from "@/lib/mock/number-format";

/**
 * Automatic Number Generator service. Produces the next document number for a
 * doc type by resolving its format (DB override else config), computing the
 * reset-period bucket, claiming the next sequence value atomically, and rendering
 * the token pattern. Kept in one place so every caller (invoice, PO, receipt, …)
 * numbers documents identically.
 */

/** The reset bucket key for a date under a given reset period. */
export function periodKeyFor(resetPeriod: string, date = new Date()): string {
  const yyyy = String(date.getFullYear());
  if (resetPeriod === "never") return "all";
  if (resetPeriod === "monthly") return `${yyyy}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  return yyyy; // yearly
}

/** Resolve a doc type's format: DB override if present, else config, else undefined. */
async function resolveFormat(docType: string): Promise<NumberFormat | undefined> {
  try {
    const row = await getNumberFormat(docType);
    if (row) {
      return {
        key: row.key,
        docType: row.docType,
        label: row.label,
        prefix: row.prefix,
        pattern: row.pattern,
        seqPadding: row.seqPadding,
        resetPeriod: row.resetPeriod as NumberFormat["resetPeriod"],
        nextSeq: 1,
        active: row.active,
      };
    }
  } catch {
    // DB unavailable → fall through to config.
  }
  return listConfigFormats().find((f) => f.key === docType || f.docType === docType);
}

export type GeneratedNumber = {
  docType: string;
  number: string;
  seq: number;
  periodKey: string;
  source: "db" | "config";
};

/**
 * Generate (claim) the next number for a doc type. Persists the counter advance
 * when the DB is reachable; otherwise renders a preview from the config's stated
 * next sequence without persisting (so callers still get a well-formed number
 * offline, flagged `source: "config"`).
 */
export async function generateNextNumber(docType: string, date = new Date()): Promise<GeneratedNumber | null> {
  const fmt = await resolveFormat(docType);
  if (!fmt) return null;

  const periodKey = periodKeyFor(fmt.resetPeriod, date);
  try {
    const seq = await claimNextSequence(fmt.docType, periodKey, fmt.nextSeq);
    return { docType: fmt.docType, number: generateSample(fmt, seq, date), seq, periodKey, source: "db" };
  } catch {
    // No DB: preview using the config's next sequence, without claiming it.
    const seq = fmt.nextSeq;
    return { docType: fmt.docType, number: generateSample(fmt, seq, date), seq, periodKey, source: "config" };
  }
}

/** Preview the next number without claiming it (does not advance the counter). */
export async function previewNextNumber(docType: string, date = new Date()): Promise<GeneratedNumber | null> {
  const fmt = await resolveFormat(docType);
  if (!fmt) return null;

  const periodKey = periodKeyFor(fmt.resetPeriod, date);
  try {
    const seq = await peekNextSequence(fmt.docType, periodKey, fmt.nextSeq);
    return { docType: fmt.docType, number: generateSample(fmt, seq, date), seq, periodKey, source: "db" };
  } catch {
    const seq = fmt.nextSeq;
    return { docType: fmt.docType, number: generateSample(fmt, seq, date), seq, periodKey, source: "config" };
  }
}
