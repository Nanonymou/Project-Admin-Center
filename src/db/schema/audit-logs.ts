import { index, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

/**
 * Cross-cutting audit log — a system-wide, policy/compliance-oriented log that
 * complements the entity-specific logs (daily_transaction_logs, approval_history,
 * period_history, invoice_activities). Captures events like cut-off input-policy
 * decisions, period status changes, and access/authorization events. Project and
 * location are nullable so genuinely system-wide events can be recorded, but are
 * set whenever the event is tenant-scoped.
 */
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: varchar("project_id", { length: 32 }),
    locationId: varchar("location_id", { length: 64 }),
    category: varchar("category", { length: 48 }).notNull(),
    action: varchar("action", { length: 64 }).notNull(),
    actor: varchar("actor", { length: 128 }),
    entityType: varchar("entity_type", { length: 48 }),
    entityId: varchar("entity_id", { length: 64 }),
    detail: varchar("detail", { length: 1024 }),
    /** Previous value for a change event (null for create/state-only events). */
    beforeValue: varchar("before_value", { length: 512 }),
    /** New value for a change event (null for pure state toggles). */
    afterValue: varchar("after_value", { length: 512 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    tenantIdx: index("audit_logs_tenant_idx").on(t.projectId, t.locationId),
    categoryIdx: index("audit_logs_category_idx").on(t.category),
    createdIdx: index("audit_logs_created_idx").on(t.createdAt),
  }),
);

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
