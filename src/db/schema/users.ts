import { index, pgTable, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { auditColumns } from "./columns";
import { roles } from "./roles";

/**
 * Users (Hak Akses feature) — the managed-user directory backing Kelola Pengguna.
 * Mirrors the config `ManagedUser`: each row is one account with an assigned
 * role (referencing the roles catalogue by key) and a status. A user's site
 * access is normalized out to `user_site_access`, so an account can be granted a
 * mix of whole-project and specific-location scopes.
 */
export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 128 }).notNull(),
    email: varchar("email", { length: 160 }).notNull(),
    /** Assigned role key → roles.role. */
    role: varchar("role", { length: 48 })
      .notNull()
      .references(() => roles.role),
    /** active | invited | suspended. */
    status: varchar("status", { length: 16 }).default("invited").notNull(),
    ...auditColumns,
  },
  (t) => ({
    emailIdx: uniqueIndex("users_email_idx").on(t.email),
    roleIdx: index("users_role_idx").on(t.role),
    // Search index on the user's name (global search matches by name).
    nameIdx: index("users_name_idx").on(t.name),
  }),
);

/**
 * User → site access grants (Hak Akses feature). Normalizes the config
 * `SiteGrant[]`: one row per project (or project+location) a user may reach. A
 * null `location_id` means "all locations under the project"; a set value scopes
 * the grant to that single site. An account with zero rows and an org-wide role
 * (super_admin) implicitly reaches everything.
 */
export const userSiteAccess = pgTable(
  "user_site_access",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    projectCode: varchar("project_code", { length: 32 }).notNull(),
    /** Null = all locations under the project; otherwise a single location. */
    locationId: varchar("location_id", { length: 64 }),
    ...auditColumns,
  },
  (t) => ({
    userIdx: index("user_site_access_user_idx").on(t.userId),
    grantIdx: uniqueIndex("user_site_access_grant_idx").on(t.userId, t.projectCode, t.locationId),
  }),
);

/**
 * Normalized role → permission grants (Hak Akses feature). A flattened,
 * queryable form of the roles.permissions matrix: one row per (role, module,
 * action). Kept alongside the jsonb matrix so permission checks can be expressed
 * as a simple indexed lookup where that is cheaper than loading the whole matrix.
 */
export const rolePermissions = pgTable(
  "role_permissions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    role: varchar("role", { length: 48 })
      .notNull()
      .references(() => roles.role, { onDelete: "cascade" }),
    module: varchar("module", { length: 48 }).notNull(),
    action: varchar("action", { length: 32 }).notNull(),
    ...auditColumns,
  },
  (t) => ({
    grantIdx: uniqueIndex("role_permissions_grant_idx").on(t.role, t.module, t.action),
    roleIdx: index("role_permissions_role_idx").on(t.role),
  }),
);

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;
export type UserSiteAccessRow = typeof userSiteAccess.$inferSelect;
export type NewUserSiteAccessRow = typeof userSiteAccess.$inferInsert;
export type RolePermissionRow = typeof rolePermissions.$inferSelect;
export type NewRolePermissionRow = typeof rolePermissions.$inferInsert;
