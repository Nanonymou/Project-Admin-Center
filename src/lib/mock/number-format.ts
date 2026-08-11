/**
 * Automatic Number Generator (config-driven mock). Per PRD §Automatic Number
 * Generator, document numbers are produced from configurable per-document
 * formats using tokens, so numbering changes via Master Data — not code. This
 * mock lists the formats and can render a sample of the next number. Frontend-
 * first: the pages drive this until the number_format table and generator
 * service land.
 *
 * Supported pattern tokens: {PREFIX} {YYYY} {YY} {MM} {DD} {SEQ}
 */

export type ResetPeriod = "yearly" | "monthly" | "never";

export type NumberFormat = {
  key: string;
  docType: string;
  label: string;
  prefix: string;
  pattern: string;
  /** Zero-pad width of the running sequence. */
  seqPadding: number;
  resetPeriod: ResetPeriod;
  nextSeq: number;
  active: boolean;
};

export const RESET_PERIOD_LABEL: Record<ResetPeriod, string> = {
  yearly: "Reset per Tahun",
  monthly: "Reset per Bulan",
  never: "Tanpa Reset",
};

const FORMATS: NumberFormat[] = [
  { key: "invoice", docType: "invoice", label: "Invoice", prefix: "INV", pattern: "{PREFIX}/{YYYY}/{MM}/{SEQ}", seqPadding: 4, resetPeriod: "monthly", nextSeq: 128, active: true },
  { key: "purchase_order", docType: "purchase_order", label: "Purchase Order", prefix: "PO", pattern: "{PREFIX}-{YYYY}{MM}-{SEQ}", seqPadding: 4, resetPeriod: "monthly", nextSeq: 57, active: true },
  { key: "receipt", docType: "receipt", label: "Kwitansi", prefix: "KW", pattern: "{PREFIX}/{YY}/{SEQ}", seqPadding: 5, resetPeriod: "yearly", nextSeq: 903, active: true },
  { key: "daily_closing", docType: "daily_closing", label: "Daily Closing", prefix: "DC", pattern: "{PREFIX}-{YYYY}{MM}{DD}-{SEQ}", seqPadding: 3, resetPeriod: "never", nextSeq: 12, active: true },
  { key: "credit_note", docType: "credit_note", label: "Credit Note", prefix: "CN", pattern: "{PREFIX}/{YYYY}/{SEQ}", seqPadding: 4, resetPeriod: "yearly", nextSeq: 8, active: false },
];

export function listNumberFormats(): NumberFormat[] {
  return FORMATS;
}

/** Render a sample document number for a format, resolving the tokens for a date. */
export function generateSample(fmt: NumberFormat, seq = fmt.nextSeq, date = new Date()): string {
  const yyyy = String(date.getFullYear());
  const tokens: Record<string, string> = {
    "{PREFIX}": fmt.prefix,
    "{YYYY}": yyyy,
    "{YY}": yyyy.slice(-2),
    "{MM}": String(date.getMonth() + 1).padStart(2, "0"),
    "{DD}": String(date.getDate()).padStart(2, "0"),
    "{SEQ}": String(seq).padStart(fmt.seqPadding, "0"),
  };
  return fmt.pattern.replace(/\{[A-Z]+\}/g, (t) => tokens[t] ?? t);
}

/** The distinct tokens a pattern uses, for UI hints. */
export function tokensInPattern(pattern: string): string[] {
  return Array.from(new Set(pattern.match(/\{[A-Z]+\}/g) ?? []));
}
