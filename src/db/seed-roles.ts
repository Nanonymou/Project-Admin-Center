import { eq } from "drizzle-orm";
import { db } from "@/db";
import { roles, rolePermissions, type NewRole, type NewRolePermissionRow } from "@/db/schema";
import { ROLE_DEFINITIONS, type RbacAction } from "@/lib/mock/rbac";

export type RoleSeedResult = { roles: number; permissions: number };

/**
 * Seed the role catalogue from the config-driven `ROLE_DEFINITIONS` — the four
 * system roles Super Admin, Leader Admin, Site Admin, and Viewer, each with its
 * per-module permission matrix. Idempotent: every role is upserted by its unique
 * key so re-running refreshes labels/permissions without creating duplicates.
 * Seeded roles are flagged `is_system` so they can be edited but not deleted.
 *
 * Both representations are seeded together: the jsonb matrix on `roles`, and the
 * flattened (role, module, action) rows on `role_permissions` — rebuilt per role
 * so the two never drift.
 */
export async function seedRoles(): Promise<RoleSeedResult> {
  const rows: NewRole[] = ROLE_DEFINITIONS.map((def) => ({
    role: def.role,
    label: def.label,
    description: def.description,
    permissions: def.permissions,
    isSystem: true,
    active: true,
    createdBy: "seed",
  }));

  let permissionCount = 0;
  for (const def of ROLE_DEFINITIONS) {
    await db
      .insert(roles)
      .values({
        role: def.role,
        label: def.label,
        description: def.description,
        permissions: def.permissions,
        isSystem: true,
        active: true,
        createdBy: "seed",
      })
      .onConflictDoUpdate({
        target: roles.role,
        set: {
          label: def.label,
          description: def.description,
          permissions: def.permissions,
          isSystem: true,
          active: true,
          updatedAt: new Date(),
        },
      });

    // Rebuild the flattened grants for this role (idempotent).
    await db.delete(rolePermissions).where(eq(rolePermissions.role, def.role));
    const flat: NewRolePermissionRow[] = Object.entries(def.permissions).flatMap(([module, actions]) =>
      (actions as RbacAction[]).map((action) => ({ role: def.role, module, action, createdBy: "seed" })),
    );
    if (flat.length > 0) await db.insert(rolePermissions).values(flat);
    permissionCount += flat.length;
  }

  return { roles: rows.length, permissions: permissionCount };
}
