import { boolean, index, integer, pgTable, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { auditColumns } from "./columns";

/**
 * Master approval timeframes — the SLA (in days) allotted to each approval stage,
 * per project and subject type. Config-driven, keyed by project_code (not a
 * project-named table); the approval-monitoring engine reads target durations
 * from here to flag at-risk / breached stages. `order_index` preserves the stage
 * order within a subject's flow.
 */
export const masterTimeframes = pgTable(
  "master_timeframes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectCode: varchar("project_code", { length: 32 }).notNull(),
    subjectType: varchar("subject_type", { length: 32 }).notNull(),
    stage: varchar("stage", { length: 64 }).notNull(),
    slaDays: integer("sla_days").default(0).notNull(),
    orderIndex: integer("order_index").default(0).notNull(),
    active: boolean("active").default(true).notNull(),
    // Responsible role (PIC) for the stage — the approver/verifier persona role.
    role: varchar("role", { length: 64 }),
    // Stage nature within the flow: verification | approval | delivery | payment.
    stageType: varchar("stage_type", { length: 32 }),
    // Whether the stage requires supporting documents before it can complete.
    requiresDocument: boolean("requires_document").default(false).notNull(),
    ...auditColumns,
  },
  (t) => ({
    keyIdx: uniqueIndex("master_timeframes_key_idx").on(t.projectCode, t.subjectType, t.stage),
    projectIdx: index("master_timeframes_project_idx").on(t.projectCode),
  }),
);

export type MasterTimeframe = typeof masterTimeframes.$inferSelect;
export type NewMasterTimeframe = typeof masterTimeframes.$inferInsert;
