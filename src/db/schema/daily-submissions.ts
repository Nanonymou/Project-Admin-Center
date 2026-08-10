import { date, index, integer, numeric, pgEnum, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { tenancyColumns, auditColumns } from "./columns";

/** Which side of the ledger a submission covers. */
export const dailySubmissionKind = pgEnum("daily_submission_kind", ["sales", "cost"]);

/** Review lifecycle of a batch submission. */
export const dailySubmissionStatus = pgEnum("daily_submission_status", [
  "draft",
  "submitted",
  "reviewed",
  "approved",
  "rejected",
]);

/**
 * Daily submission — the batch "submit for approval" event behind the Submit
 * Daily Cost (and Daily Sales) flow. One row per site per submission date per
 * kind, tracking the review lifecycle plus the submitted total and entry count.
 * Distinct from `daily_closings` (a per-day checkpoint) and `daily_transactions`
 * (individual entries): this is the reviewable submission a Leader Admin acts on.
 * Generic via `kind`, tenant-scoped by project_id/location_id.
 */
export const dailySubmissions = pgTable(
  "daily_submissions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ...tenancyColumns,
    kind: dailySubmissionKind("kind").notNull(),
    submissionDate: date("submission_date").notNull(),
    status: dailySubmissionStatus("status").default("draft").notNull(),
    totalAmount: numeric("total_amount", { precision: 18, scale: 2 }).default("0").notNull(),
    entryCount: integer("entry_count").default(0).notNull(),
    submittedBy: varchar("submitted_by", { length: 128 }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    reviewedBy: varchar("reviewed_by", { length: 128 }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    note: varchar("note", { length: 512 }),
    ...auditColumns,
  },
  (t) => ({
    tenantIdx: index("daily_submissions_tenant_idx").on(t.projectId, t.locationId),
    kindIdx: index("daily_submissions_kind_idx").on(t.kind),
    statusIdx: index("daily_submissions_status_idx").on(t.status),
    dateIdx: index("daily_submissions_date_idx").on(t.submissionDate),
  }),
);

export type DailySubmission = typeof dailySubmissions.$inferSelect;
export type NewDailySubmission = typeof dailySubmissions.$inferInsert;
