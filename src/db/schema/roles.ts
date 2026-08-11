import { boolean, jsonb, pgTable, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { auditColumns } from "./columns";
import type { RbacModule, RbacAction } from "@/lib/mock/rbac";

/**
 * Roles (Role feature) — the persisted role catalogue + permission matrix that
 * backs the `/role` UI. Mirrors the config-driven `ROLE_DEFINITIONS`: each row is
 * one role with its per-module allowed-action matrix stored as JSON, so the set
 * of permissions can be edited without a schema change. The four seed roles
 * (super_admin / leader_admin / site_admin / viewer) are system roles that cannot
 * be deleted; custom roles may be added later.
 */
export const roles = pgTable(
  "roles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** Stable machine key, e.g. `site_admin`. Unique. */
    role: varchar("role", { length: 48 }).notNull(),
    label: varchar("label", { length: 128 }).notNull(),
    description: varchar("description", { length: 512 }).notNull().default(""),
    /** Per-module allowed actions: Record<RbacModule, RbacAction[]>. */
    permissions: jsonb("permissions").$type<Record<RbacModule, RbacAction[]>>().notNull(),
    /** System roles are seeded and cannot be removed, only edited. */
    isSystem: boolean("is_system").default(false).notNull(),
    active: boolean("active").default(true).notNull(),
    ...auditColumns,
  },
  (t) => ({
    roleIdx: uniqueIndex("roles_role_idx").on(t.role),
  }),
);

export type Role = typeof roles.$inferSelect;
export type NewRole = typeof roles.$inferInsert;
