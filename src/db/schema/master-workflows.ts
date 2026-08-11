import { boolean, index, integer, pgTable, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { auditColumns } from "./columns";

/**
 * Master workflow timeframe — a named, ordered process (per subject type) that a
 * site runs, e.g. "Proses Invoice" or "Daily Closing". Config-driven and keyed
 * by project_code + location_id so each site can carry its own workflow; the
 * `master_timeframes` table holds approval-stage SLAs, while this pair models the
 * broader workflow + its activities uploaded via Master Timeframe (Excel). This
 * backs the `/master-timeframe` UI's `workflow-config` mock.
 */
export const masterWorkflows = pgTable(
  "master_workflows",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectCode: varchar("project_code", { length: 32 }).notNull(),
    locationId: varchar("location_id", { length: 64 }).notNull(),
    subjectType: varchar("subject_type", { length: 32 }).notNull(),
    code: varchar("code", { length: 64 }).notNull(),
    name: varchar("name", { length: 128 }).notNull(),
    active: boolean("active").default(true).notNull(),
    ...auditColumns,
  },
  (t) => ({
    keyIdx: uniqueIndex("master_workflows_key_idx").on(t.locationId, t.subjectType),
    projectIdx: index("master_workflows_project_idx").on(t.projectCode),
  }),
);

/**
 * Workflow activity — a single ordered step within a `master_workflows` row,
 * with its SLA (days) and responsible PIC role. Deleting a workflow cascades to
 * its activities.
 */
export const workflowActivities = pgTable(
  "workflow_activities",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workflowId: uuid("workflow_id")
      .notNull()
      .references(() => masterWorkflows.id, { onDelete: "cascade" }),
    orderIndex: integer("order_index").default(0).notNull(),
    name: varchar("name", { length: 128 }).notNull(),
    slaDays: integer("sla_days").default(0).notNull(),
    pic: varchar("pic", { length: 64 }),
    ...auditColumns,
  },
  (t) => ({
    workflowIdx: index("workflow_activities_workflow_idx").on(t.workflowId),
    orderIdx: uniqueIndex("workflow_activities_order_idx").on(t.workflowId, t.orderIndex),
  }),
);

export type MasterWorkflow = typeof masterWorkflows.$inferSelect;
export type NewMasterWorkflow = typeof masterWorkflows.$inferInsert;
export type WorkflowActivity = typeof workflowActivities.$inferSelect;
export type NewWorkflowActivity = typeof workflowActivities.$inferInsert;
