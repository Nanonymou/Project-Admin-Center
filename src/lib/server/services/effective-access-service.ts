import type { Persona } from "@/lib/personas";
import { getRole } from "@/db/repositories/role-repository";
import type { AuthzResult } from "@/lib/server/rbac";

/**
 * Effective-access adjustment for deactivated roles (Role feature). When a role
 * is deactivated after users are already assigned to it, those users must lose
 * the privileges the role carried — an inactive role grants nothing. This service
 * resolves a persona's *effective* access at request time: if the persona's role
 * has been deactivated, every capability is stripped so they fall back to
 * read-only. DB is authoritative; when it is unavailable (or the role is not yet
 * persisted) the persona is left unchanged, since seeded roles are always active.
 */

export type EffectiveAccess = {
  persona: Persona;
  /** True when the persona's role was deactivated and capabilities were stripped. */
  downgraded: boolean;
};

const NO_CAPABILITIES: Persona["capabilities"] = {
  canExport: false,
  canSwitchWorkspace: false,
  canApprove: false,
  canConfigure: false,
};

/**
 * Resolve the persona's effective access. Returns a capability-stripped copy when
 * their role is deactivated, otherwise the persona unchanged.
 */
export async function resolveEffectiveAccess(persona: Persona): Promise<EffectiveAccess> {
  try {
    const row = await getRole(persona.role);
    // Only downgrade when the role is persisted AND explicitly inactive. An
    // absent row means "not yet seeded" — treat as active (config default).
    if (row && !row.active) {
      return { persona: { ...persona, capabilities: { ...NO_CAPABILITIES } }, downgraded: true };
    }
    return { persona, downgraded: false };
  } catch {
    return { persona, downgraded: false };
  }
}

/**
 * Guard: fail the request when the persona's role has been deactivated. Use on
 * endpoints that require live privileges, so a user whose role was turned off
 * cannot keep acting on a stale session. Returns 403 when downgraded.
 */
export async function enforceActiveRole(persona: Persona): Promise<AuthzResult> {
  const { downgraded } = await resolveEffectiveAccess(persona);
  if (downgraded) {
    return { ok: false, status: 403, message: "Role Anda telah dinonaktifkan — akses dicabut." };
  }
  return { ok: true };
}
