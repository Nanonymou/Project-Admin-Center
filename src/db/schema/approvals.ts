import { relations } from "drizzle-orm";
import { date, index, pgEnum, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { auditColumns, tenancyColumns } from "./columns";

/**
 * What an approval workflow is attached to. The same generic approval engine
 * serves invoices and daily closings, so the concrete stages are stored as a
 * config-driven varchar (keyed by subject type + project config) rather than a
 * fixed enum — no project- or subject-specific stage list is baked in here.
 */
export const approvalSubjectType = pgEnum("approval_subject_type", ["invoice", "daily_closing"]);

/** Overall state of an approval workflow instance. */
export const approvalStatus = pgEnum("approval_status", [
  "in_progress",
  "approved",
  "rejected",
  "returned",
  "completed",
]);

/** The action recorded on each history entry. */
export const approvalAction = pgEnum("approval_action", [
  "submit",
  "approve",
  "reject",
  "return",
  "reassign",
]);

/**
 * Approval workflow instance — one row per subject (an invoice or a daily
 * closing) currently moving through its approval stages. Tenant-scoped by
 * project_id/location_id. `currentStage` holds the config-driven stage key.
 */
export const approvals = pgTable(
  "approvals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ...tenancyColumns,
    subjectType: approvalSubjectType("subject_type").notNull(),
    subjectId: varchar("subject_id", { length: 64 }).notNull(),
    currentStage: varchar("current_stage", { length: 64 }).notNull(),
    status: approvalStatus("status").default("in_progress").notNull(),
    assignedTo: varchar("assigned_to", { length: 128 }),
    dueDate: date("due_date"),
    ...auditColumns,
  },
  (t) => ({
    tenantIdx: index("approvals_tenant_idx").on(t.projectId, t.locationId),
    subjectIdx: index("approvals_subject_idx").on(t.subjectType, t.subjectId),
    statusIdx: index("approvals_status_idx").on(t.status),
    stageIdx: index("approvals_stage_idx").on(t.currentStage),
  }),
);

/**
 * Append-only approval history — one row per stage transition / action, so the
 * full audit trail of who moved a subject between which stages is preserved.
 * Never updated after insert.
 */
export const approvalHistory = pgTable(
  "approval_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    approvalId: uuid("approval_id")
      .notNull()
      .references(() => approvals.id, { onDelete: "cascade" }),
    ...tenancyColumns,
    fromStage: varchar("from_stage", { length: 64 }),
    toStage: varchar("to_stage", { length: 64 }).notNull(),
    action: approvalAction("action").notNull(),
    actor: varchar("actor", { length: 128 }).notNull(),
    note: varchar("note", { length: 512 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    approvalIdx: index("approval_history_approval_idx").on(t.approvalId),
    tenantIdx: index("approval_history_tenant_idx").on(t.projectId, t.locationId),
    createdIdx: index("approval_history_created_idx").on(t.createdAt),
  }),
);

export const approvalsRelations = relations(approvals, ({ many }) => ({
  history: many(approvalHistory),
}));

export const approvalHistoryRelations = relations(approvalHistory, ({ one }) => ({
  approval: one(approvals, {
    fields: [approvalHistory.approvalId],
    references: [approvals.id],
  }),
}));

export type Approval = typeof approvals.$inferSelect;
export type NewApproval = typeof approvals.$inferInsert;
export type ApprovalHistoryEntry = typeof approvalHistory.$inferSelect;
export type NewApprovalHistoryEntry = typeof approvalHistory.$inferInsert;
