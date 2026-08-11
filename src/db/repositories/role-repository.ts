import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { roles, type Role, type NewRole } from "@/db/schema";
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
