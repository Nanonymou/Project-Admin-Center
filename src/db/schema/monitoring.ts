import { bigint, index, integer, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

/**
 * User activity / session monitoring — one row per notable user action (login,
 * logout, workspace switch, sensitive operation). Not tenant-scoped by
 * construction (a user may span projects), but `project_id` is set when the
 * action is scoped to one. Feeds the User Monitoring view.
 */
export const userActivity = pgTable(
  "user_activity",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    personaId: varchar("persona_id", { length: 64 }).notNull(),
    actorName: varchar("actor_name", { length: 128 }),
    role: varchar("role", { length: 32 }),
    action: varchar("action", { length: 64 }).notNull(),
    projectId: varchar("project_id", { length: 32 }),
    locationId: varchar("location_id", { length: 64 }),
    ipAddress: varchar("ip_address", { length: 64 }),
    userAgent: varchar("user_agent", { length: 256 }),
    detail: varchar("detail", { length: 512 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    personaIdx: index("user_activity_persona_idx").on(t.personaId),
    actionIdx: index("user_activity_action_idx").on(t.action),
    createdIdx: index("user_activity_created_idx").on(t.createdAt),
  }),
);

/**
 * Storage metrics — periodic snapshots of storage consumption per category
 * (attachments, backups, transactions, database), optionally per project. Feeds
 * the Storage Monitoring view. `size_bytes` and `item_count` are the snapshot
 * values captured at `captured_at`.
 */
export const storageMetrics = pgTable(
  "storage_metrics",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: varchar("project_id", { length: 32 }),
    category: varchar("category", { length: 48 }).notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).default(0).notNull(),
    itemCount: integer("item_count").default(0).notNull(),
    capturedAt: timestamp("captured_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    projectIdx: index("storage_metrics_project_idx").on(t.projectId),
    categoryIdx: index("storage_metrics_category_idx").on(t.category),
    capturedIdx: index("storage_metrics_captured_idx").on(t.capturedAt),
  }),
);

export type UserActivity = typeof userActivity.$inferSelect;
export type NewUserActivity = typeof userActivity.$inferInsert;
export type StorageMetric = typeof storageMetrics.$inferSelect;
export type NewStorageMetric = typeof storageMetrics.$inferInsert;
