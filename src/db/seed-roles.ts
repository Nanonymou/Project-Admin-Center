import { db } from "@/db";
import { roles, type NewRole } from "@/db/schema";
import { ROLE_DEFINITIONS } from "@/lib/mock/rbac";

export type RoleSeedResult = { roles: number };

/**
 * Seed the role catalogue from the config-driven `ROLE_DEFINITIONS` — the four
 * system roles Super Admin, Leader Admin, Site Admin, and Viewer, each with its
 * per-module permission matrix. Idempotent: every role is upserted by its unique
 * key so re-running refreshes labels/permissions without creating duplicates.
 * Seeded roles are flagged `is_system` so they can be edited but not deleted.
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

  for (const row of rows) {
    await db
      .insert(roles)
      .values(row)
      .onConflictDoUpdate({
        target: roles.role,
        set: {
          label: row.label,
          description: row.description,
          permissions: row.permissions,
          isSystem: true,
          active: true,
          updatedAt: new Date(),
        },
      });
  }

  return { roles: rows.length };
}
