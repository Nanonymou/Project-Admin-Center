import { boolean, integer, pgTable, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { auditColumns } from "./columns";

/**
 * Automatic Number Generator — per-document-type number formats (PRD §Automatic
 * Number Generator). A format is a token pattern ({PREFIX} {YYYY} {YY} {MM} {DD}
 * {SEQ}) plus a zero-pad width and a reset period, so document numbering is
 * configurable Master Data rather than code. Backs the `/number-generator` UI's
 * `number-format` config.
 */
export const numberFormats = pgTable(
  "number_formats",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** Stable key, usually equal to docType. Unique. */
    key: varchar("key", { length: 48 }).notNull(),
    docType: varchar("doc_type", { length: 48 }).notNull(),
    label: varchar("label", { length: 128 }).notNull(),
    prefix: varchar("prefix", { length: 16 }).notNull().default(""),
    pattern: varchar("pattern", { length: 128 }).notNull(),
    seqPadding: integer("seq_padding").default(4).notNull(),
    /** yearly | monthly | never. */
    resetPeriod: varchar("reset_period", { length: 16 }).notNull().default("yearly"),
    active: boolean("active").default(true).notNull(),
    ...auditColumns,
  },
  (t) => ({
    keyIdx: uniqueIndex("number_formats_key_idx").on(t.key),
  }),
);

/**
 * Running sequence counters for the number generator. One row per (docType,
 * period bucket) — the bucket being the year, year-month, or a constant for
 * "never", per the format's reset period. `nextSeq` is the next value to hand
 * out; the generator increments it atomically so numbers are unique and gap-free
 * within a bucket. Separating the counter from the format lets the format change
 * without disturbing the live sequence.
 */
export const numberSequences = pgTable(
  "number_sequences",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    docType: varchar("doc_type", { length: 48 }).notNull(),
    /** Reset bucket, e.g. "2026", "2026-08", or "all". */
    periodKey: varchar("period_key", { length: 16 }).notNull(),
    nextSeq: integer("next_seq").default(1).notNull(),
    ...auditColumns,
  },
  (t) => ({
    bucketIdx: uniqueIndex("number_sequences_bucket_idx").on(t.docType, t.periodKey),
  }),
);

export type NumberFormatRow = typeof numberFormats.$inferSelect;
export type NewNumberFormatRow = typeof numberFormats.$inferInsert;
export type NumberSequenceRow = typeof numberSequences.$inferSelect;
export type NewNumberSequenceRow = typeof numberSequences.$inferInsert;
