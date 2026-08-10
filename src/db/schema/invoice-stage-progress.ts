import { relations } from "drizzle-orm";
import { boolean, date, index, integer, pgEnum, pgTable, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { auditColumns, softDeleteColumns, tenancyColumns } from "./columns";
import { invoices } from "./invoices";

/** Progress state of a single stage on an invoice's processing timeline. */
export const stageProgressState = pgEnum("stage_progress_state", ["pending", "current", "done"]);

/**
 * Invoice processing timeline — one row per invoice per approval stage, tracking
 * how the invoice moves through the config-driven stage flow with its SLA and
 * actual timing. Tenant-scoped by project_id/location_id and linked to the
 * invoice by FK. `stage` is the config-driven stage key (no project-named
 * columns); `sla_days` snapshots the timeframe config in effect; `actual_days`
 * and `breached` record whether the stage ran over its SLA. `doc_count` mirrors
 * how many supporting documents were attached at the stage. One row per
 * (invoice, stage), enforced by a unique index.
 */
export const invoiceStageProgress = pgTable(
  "invoice_stage_progress",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    ...tenancyColumns,
    stage: varchar("stage", { length: 64 }).notNull(),
    stageOrder: integer("stage_order").default(0).notNull(),
    slaDays: integer("sla_days").default(0).notNull(),
    state: stageProgressState("state").default("pending").notNull(),
    startedAt: date("started_at"),
    completedAt: date("completed_at"),
    actualDays: integer("actual_days").default(0).notNull(),
    breached: boolean("breached").default(false).notNull(),
    pic: varchar("pic", { length: 128 }),
    docCount: integer("doc_count").default(0).notNull(),
    ...auditColumns,
    ...softDeleteColumns,
  },
  (t) => ({
    invoiceIdx: index("invoice_stage_progress_invoice_idx").on(t.invoiceId),
    tenantIdx: index("invoice_stage_progress_tenant_idx").on(t.projectId, t.locationId),
    // One progress row per invoice stage.
    stageUnique: uniqueIndex("invoice_stage_progress_stage_unique_idx").on(t.invoiceId, t.stage),
    // Serves the ordered timeline render + breach reporting.
    orderIdx: index("invoice_stage_progress_order_idx").on(t.invoiceId, t.stageOrder),
    breachIdx: index("invoice_stage_progress_breach_idx").on(t.projectId, t.locationId, t.breached),
  }),
);

export const invoiceStageProgressRelations = relations(invoiceStageProgress, ({ one }) => ({
  invoice: one(invoices, {
    fields: [invoiceStageProgress.invoiceId],
    references: [invoices.id],
  }),
}));

export type InvoiceStageProgress = typeof invoiceStageProgress.$inferSelect;
export type NewInvoiceStageProgress = typeof invoiceStageProgress.$inferInsert;
