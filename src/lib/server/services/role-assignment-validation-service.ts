import { getRole } from "@/db/repositories/role-repository";
import { listRoles as listConfigRoles } from "@/lib/mock/rbac";

/**
 * Role-assignment validation (Role feature). Guards user creation/editing so a
 * new or updated user can never be assigned a role that is unknown or has been
 * deactivated — an inactive role must not leak permissions to a fresh account.
 * DB is the source of truth; when it is unavailable the config catalogue (whose
 * seeded roles are always active) is used so validation still works offline.
 */

export type RoleAssignmentCheck = { ok: true } | { ok: false; status: number; message: string };

/**
 * Verify a role key may be assigned to a user. Returns `{ ok: true }` when the
 * role exists and is active, otherwise a typed failure with an HTTP status:
 * 422 for an unknown role, 409 for a known-but-deactivated role.
 */
export async function validateRoleAssignable(role: string): Promise<RoleAssignmentCheck> {
  const key = role.trim();
  if (!key) return { ok: false, status: 422, message: "Role wajib dipilih." };

  try {
    const row = await getRole(key);
    if (!row) return { ok: false, status: 422, message: `Role "${key}" tidak dikenal.` };
    if (!row.active) {
      return { ok: false, status: 409, message: `Role "${row.label}" nonaktif — tidak dapat diberikan ke user baru.` };
    }
    return { ok: true };
  } catch {
    // DB unavailable: fall back to the config catalogue (all seeded roles active).
    const known = listConfigRoles().some((r) => r.role === key);
    return known
      ? { ok: true }
      : { ok: false, status: 422, message: `Role "${key}" tidak dikenal.` };
  }
}
