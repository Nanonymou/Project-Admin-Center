import { relations } from "drizzle-orm";
import { bigint, index, pgEnum, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

/** Kind of backup snapshot. */
export const backupKind = pgEnum("backup_kind", ["full", "incremental"]);

/** Status shared by backup and restore jobs. */
export const backupJobStatus = pgEnum("backup_job_status", [
  "pending",
  "running",
  "completed",
  "failed",
]);

/**
 * Backups — one row per backup snapshot. `project_id` is nullable so both
 * per-project and system-wide backups are represented. `storage_key` points at
 * the stored artifact; size and timing are recorded for the Backup & Restore UI.
 */
export const backups = pgTable(
  "backups",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: varchar("project_id", { length: 32 }),
    label: varchar("label", { length: 160 }).notNull(),
    kind: backupKind("kind").default("full").notNull(),
    status: backupJobStatus("status").default("pending").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).default(0).notNull(),
    storageKey: varchar("storage_key", { length: 512 }),
    createdBy: varchar("created_by", { length: 128 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => ({
    projectIdx: index("backups_project_idx").on(t.projectId),
    statusIdx: index("backups_status_idx").on(t.status),
    createdIdx: index("backups_created_idx").on(t.createdAt),
  }),
);

/**
 * Restore history — one row per restore attempt against a backup, preserving who
 * restored what and the outcome.
 */
export const restoreHistory = pgTable(
  "restore_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    backupId: uuid("backup_id")
      .notNull()
      .references(() => backups.id, { onDelete: "cascade" }),
    status: backupJobStatus("status").default("pending").notNull(),
    restoredBy: varchar("restored_by", { length: 128 }),
    note: varchar("note", { length: 512 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => ({
    backupIdx: index("restore_history_backup_idx").on(t.backupId),
    createdIdx: index("restore_history_created_idx").on(t.createdAt),
  }),
);

export const backupsRelations = relations(backups, ({ many }) => ({
  restores: many(restoreHistory),
}));

export const restoreHistoryRelations = relations(restoreHistory, ({ one }) => ({
  backup: one(backups, {
    fields: [restoreHistory.backupId],
    references: [backups.id],
  }),
}));

export type Backup = typeof backups.$inferSelect;
export type NewBackup = typeof backups.$inferInsert;
export type RestoreHistoryEntry = typeof restoreHistory.$inferSelect;
export type NewRestoreHistoryEntry = typeof restoreHistory.$inferInsert;
