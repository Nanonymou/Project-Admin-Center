import { boolean, index, integer, pgTable, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { auditColumns } from "./columns";

/**
 * Master Lock & Version Management — lock state per master-data domain (Master
 * Lock feature, PRD §Master Lock & Version Management). Each row is one lockable
 * master entity (pricing / formula / tax / workflow / …). When `locked` is true
 * the domain's configuration is frozen and its edit APIs must refuse writes.
 * `version` is the current version number, bumped on each committed change; the
 * per-version detail lives in `master_versions`. Backs the `/master-lock` UI's
 * `master-lock` config.
 */
export const masterLocks = pgTable(
  "master_locks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** Stable domain key, e.g. `pricing`, `formula`, `tax`. Unique. */
    entityKey: varchar("entity_key", { length: 48 }).notNull(),
    label: varchar("label", { length: 128 }).notNull(),
    category: varchar("category", { length: 48 }).notNull().default(""),
    locked: boolean("locked").default(false).notNull(),
    version: integer("version").default(1).notNull(),
    lastModifiedBy: varchar("last_modified_by", { length: 128 }),
    lastModifiedAt: timestamp("last_modified_at", { withTimezone: true }).defaultNow().notNull(),
    ...auditColumns,
  },
  (t) => ({
    entityIdx: uniqueIndex("master_locks_entity_idx").on(t.entityKey),
    categoryIdx: index("master_locks_category_idx").on(t.category),
  }),
);

/**
 * Non-destructive version history for master-data domains. One row per committed
 * version of an entity, so a change can be traced (and, later, restored) without
 * overwriting the prior value. Never updated in place.
 */
export const masterVersions = pgTable(
  "master_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    entityKey: varchar("entity_key", { length: 48 }).notNull(),
    version: integer("version").notNull(),
    changedBy: varchar("changed_by", { length: 128 }),
    summary: varchar("summary", { length: 512 }).notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    entityIdx: index("master_versions_entity_idx").on(t.entityKey),
    versionIdx: uniqueIndex("master_versions_entity_version_idx").on(t.entityKey, t.version),
  }),
);

export type MasterLockRow = typeof masterLocks.$inferSelect;
export type NewMasterLockRow = typeof masterLocks.$inferInsert;
export type MasterVersionRow = typeof masterVersions.$inferSelect;
export type NewMasterVersionRow = typeof masterVersions.$inferInsert;
