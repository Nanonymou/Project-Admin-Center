import { relations } from "drizzle-orm";
import { index, pgEnum, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { tenancyColumns } from "./columns";
import { dailySubmissions } from "./daily-submissions";

/** The approval action recorded on a submission's history. */
export const submissionHistoryAction = pgEnum("submission_history_action", [
  "submit",
  "review",
  "approve",
  "reject",
  "resubmit",
]);

/**
 * Append-only approval history for daily submissions (Persetujuan Daily Sales /
 * Cost). One row per action taken on a `daily_submissions` batch, recording the
 * from/to status, who acted, and any reason (e.g. a rejection note). Linked to
 * the submission by FK and tenant-scoped by project_id/location_id; never updated
 * after insert.
 */
export const dailySubmissionHistory = pgTable(
  "daily_submission_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    submissionId: uuid("submission_id")
      .notNull()
      .references(() => dailySubmissions.id, { onDelete: "cascade" }),
    ...tenancyColumns,
    action: submissionHistoryAction("action").notNull(),
    fromStatus: varchar("from_status", { length: 24 }),
    toStatus: varchar("to_status", { length: 24 }).notNull(),
    actor: varchar("actor", { length: 128 }),
    reason: varchar("reason", { length: 512 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    submissionIdx: index("daily_submission_history_submission_idx").on(t.submissionId),
    tenantIdx: index("daily_submission_history_tenant_idx").on(t.projectId, t.locationId),
  }),
);

export const dailySubmissionHistoryRelations = relations(dailySubmissionHistory, ({ one }) => ({
  submission: one(dailySubmissions, {
    fields: [dailySubmissionHistory.submissionId],
    references: [dailySubmissions.id],
  }),
}));

export type DailySubmissionHistory = typeof dailySubmissionHistory.$inferSelect;
export type NewDailySubmissionHistory = typeof dailySubmissionHistory.$inferInsert;
