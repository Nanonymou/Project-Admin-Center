import { boolean, index, integer, pgTable, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { auditColumns } from "./columns";
import { approvalSubjectType } from "./approvals";

/**
 * SLA approval targets — the overall service-level agreement for an approval
 * flow, per project and subject type (invoice / daily_closing). Config-driven and
 * keyed by `project_code` (not a project-named table); the SLA Approval
 * Monitoring engine reads these targets to classify each in-flight approval as
 * on-time, at-risk, or breached.
 *
 * `target_days` is the end-to-end SLA (from submission to final approval), which
 * complements the per-stage durations in `master_timeframes`. `at_risk_pct` is
 * the fraction of the target elapsed at which an approval is flagged at-risk
 * (e.g. 80 → warn once 80% of the target has passed). `breach_grace_days` allows
 * a grace window before an overdue approval counts as a hard breach.
 */
export const slaTargets = pgTable(
  "sla_targets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectCode: varchar("project_code", { length: 32 }).notNull(),
    subjectType: approvalSubjectType("subject_type").notNull(),
    targetDays: integer("target_days").default(0).notNull(),
    atRiskPct: integer("at_risk_pct").default(80).notNull(),
    breachGraceDays: integer("breach_grace_days").default(0).notNull(),
    active: boolean("active").default(true).notNull(),
    ...auditColumns,
  },
  (t) => ({
    keyIdx: uniqueIndex("sla_targets_key_idx").on(t.projectCode, t.subjectType),
    projectIdx: index("sla_targets_project_idx").on(t.projectCode),
  }),
);

export type SlaTarget = typeof slaTargets.$inferSelect;
export type NewSlaTarget = typeof slaTargets.$inferInsert;
