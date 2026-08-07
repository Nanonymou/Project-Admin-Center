import { canAccessProject, getPersonaById, type Persona } from "@/lib/personas";

/**
 * Resolve the calling persona from request headers. The frontend sends the
 * active persona id via `x-persona-id` (RBAC simulation). Missing/unknown ids
 * fall back to the most restricted read-only viewer.
 */
export function getPersonaFromHeaders(headers: Headers): Persona {
  const id = headers.get("x-persona-id") ?? "persona-viewer";
  return getPersonaById(id);
}

export type AuthzResult = { ok: true } | { ok: false; status: number; message: string };

/**
 * Enforce role & scope authorization for a dashboard query.
 * - Executive (cross-project) scope requires Leader/Super Admin.
 * - A project filter must be inside the persona's project scope.
 * - A location filter must be inside the persona's location scope.
 */
export function authorizeDashboard(
  persona: Persona,
  filter: { projectId?: string; locationId?: string; scope?: "tenant" | "executive" },
): AuthzResult {
  if (filter.scope === "executive" && !filter.projectId) {
    const canExecutive = persona.role === "super_admin" || persona.role === "leader_admin";
    if (!canExecutive) {
      return { ok: false, status: 403, message: "Executive dashboard hanya untuk Leader/Super Admin." };
    }
    return { ok: true };
  }

  if (filter.projectId && !canAccessProject(persona, filter.projectId)) {
    return { ok: false, status: 403, message: `Tidak ada akses ke project ${filter.projectId}.` };
  }

  if (
    filter.locationId &&
    persona.scope.locations.length > 0 &&
    !persona.scope.locations.includes(filter.locationId)
  ) {
    return { ok: false, status: 403, message: `Tidak ada akses ke lokasi ${filter.locationId}.` };
  }

  return { ok: true };
}
