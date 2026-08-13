import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { roles, rolePermissions, type Role, type NewRole, type RolePermissionRow } from "@/db/schema";
import type { RbacModule, RbacAction } from "@/lib/mock/rbac";

/**
 * Role data access. Repository Pattern: all DB access to the roles table flows
 * through this module. System roles (is_system) may be edited but never deleted;
 * deactivation is a soft toggle so historical assignments stay resolvable.
 */

export async function listRoles(activeOnly = false): Promise<Role[]> {
  const rows = await db.select().from(roles).orderBy(asc(roles.role));
  return activeOnly ? rows.filter((r) => r.active) : rows;
}

export async function getRole(role: string): Promise<Role | undefined> {
  const [row] = await db.select().from(roles).where(eq(roles.role, role)).limit(1);
  return row;
}

export type UpsertRoleInput = {
  role: string;
  label: string;
  description?: string;
  permissions: Record<RbacModule, RbacAction[]>;
  createdBy?: string;
};

/** Create or update a custom role by its unique key. */
export async function upsertRole(input: UpsertRoleInput): Promise<void> {
  const values: NewRole = {
    role: input.role,
    label: input.label,
    description: input.description ?? "",
    permissions: input.permissions,
    isSystem: false,
    active: true,
    createdBy: input.createdBy,
  };
  await db
    .insert(roles)
    .values(values)
    .onConflictDoUpdate({
      target: roles.role,
      set: {
        label: values.label,
        description: values.description,
        permissions: values.permissions,
        updatedAt: new Date(),
      },
    });
}

/** Activate/deactivate a role by key (soft — the row is retained). */
export async function setRoleActive(role: string, active: boolean): Promise<void> {
  await db.update(roles).set({ active, updatedAt: new Date() }).where(eq(roles.role, role));
}

/** Permanently delete a custom (non-system) role. Returns false if not deletable. */
export async function deleteCustomRole(role: string): Promise<boolean> {
  const existing = await getRole(role);
  if (!existing || existing.isSystem) return false;
  await db.delete(roles).where(eq(roles.role, role));
  return true;
}

/** List the normalized (role, module, action) permission grants for a role. */
export async function listRolePermissions(role: string): Promise<RolePermissionRow[]> {
  return db.select().from(rolePermissions).where(eq(rolePermissions.role, role));
}

/**
 * Set a role's permission matrix with immediate effect: updates the jsonb matrix
 * on the role row AND replaces the normalized role_permissions rows in one
 * transaction, so every permission check — whether it reads the matrix or the
 * flattened rows — sees the new grants at once. Returns false when the role
 * does not exist (permissions are never created for an unknown role).
 */
export async function setRolePermissions(
  role: string,
  permissions: Record<RbacModule, RbacAction[]>,
  changedBy?: string,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [existing] = await tx.select({ role: roles.role }).from(roles).where(eq(roles.role, role)).limit(1);
    if (!existing) return false;

    await tx.update(roles).set({ permissions, updatedAt: new Date() }).where(eq(roles.role, role));

    // Rebuild the flattened grants so the two representations never drift.
    await tx.delete(rolePermissions).where(eq(rolePermissions.role, role));
    const flat = Object.entries(permissions).flatMap(([module, actions]) =>
      (actions as RbacAction[]).map((action) => ({ role, module, action, createdBy: changedBy })),
    );
    if (flat.length > 0) await tx.insert(rolePermissions).values(flat);
    return true;
  });
}
