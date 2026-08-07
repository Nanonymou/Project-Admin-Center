import { relations } from "drizzle-orm";
import { index, pgEnum, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { tenancyColumns } from "./columns";
import { invoices } from "./invoices";

/**
 * Activity types recorded on an invoice's timeline. Aligned with the audit
 * actions used elsewhere, plus timeline-specific events (comment, reminder).
 */
export const invoiceActivityAction = pgEnum("invoice_activity_action", [
  "create",
  "edit",
  "submit",
  "review",
  "approve",
  "reject",
  "lock",
  "unlock",
  "upload",
  "send",
  "comment",
  "remind",
]);

/**
 * Append-only invoice activity timeline — one row per event in an invoice's
 * life (created, edited, submitted, stage transitions, document uploads,
 * comments, reminders). Tenant-scoped by project_id/location_id and linked to
 * the invoice by FK. Never updated after insert; ordered by created_at when
 * rendered as a timeline.
 */
export const invoiceActivities = pgTable(
  "invoice_activities",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    ...tenancyColumns,
    action: invoiceActivityAction("action").notNull(),
    actor: varchar("actor", { length: 128 }).notNull(),
    role: varchar("role", { length: 64 }),
    fromStage: varchar("from_stage", { length: 64 }),
    toStage: varchar("to_stage", { length: 64 }),
    detail: varchar("detail", { length: 512 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    invoiceIdx: index("invoice_activities_invoice_idx").on(t.invoiceId),
    tenantIdx: index("invoice_activities_tenant_idx").on(t.projectId, t.locationId),
    createdIdx: index("invoice_activities_created_idx").on(t.createdAt),
    actionIdx: index("invoice_activities_action_idx").on(t.action),
  }),
);

export const invoiceActivitiesRelations = relations(invoiceActivities, ({ one }) => ({
  invoice: one(invoices, {
    fields: [invoiceActivities.invoiceId],
    references: [invoices.id],
  }),
}));

export type InvoiceActivity = typeof invoiceActivities.$inferSelect;
export type NewInvoiceActivity = typeof invoiceActivities.$inferInsert;
