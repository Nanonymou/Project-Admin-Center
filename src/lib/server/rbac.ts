import { canAccessProject, getPersonaById, type Persona } from "@/lib/personas";
import { projectsForLocations, sanitizeLocationIds } from "@/lib/site-access";

/**
 * Apply a per-account site grant (`x-persona-locations`) over the persona
 * template. A Super Admin can scope an account to specific sites; the client
 * sends that grant alongside the persona id so server authorization matches the
 * client's view (same client-trusted model as `x-persona-id`).
 */
function applyGrantedScope(persona: Persona, headers: Headers): Persona {
  const raw = headers.get("x-persona-locations");
  if (!raw) return persona;
  const locations = sanitizeLocationIds(raw.split(",").map((s) => s.trim()).filter(Boolean));
  if (locations.length === 0) return persona;
  return { ...persona, scope: { projects: projectsForLocations(locations), locations } };
}

/**
 * Resolve the calling persona from request headers. The frontend sends the
 * active persona id via `x-persona-id` (RBAC simulation). Missing/unknown ids
 * fall back to the most restricted read-only viewer.
 */
export function getPersonaFromHeaders(headers: Headers): Persona {
  const id = headers.get("x-persona-id") ?? "persona-viewer";
  return applyGrantedScope(getPersonaById(id), headers);
}

export type AuthzResult = { ok: true } | { ok: false; status: number; message: string };

/**
 * Require an authenticated persona. A missing `x-persona-id` header is treated
 * as unauthenticated (401), distinct from an authenticated-but-forbidden 403.
 */
export function requirePersona(
  headers: Headers,
): { ok: true; persona: Persona } | { ok: false; status: 401; message: string } {
  const id = headers.get("x-persona-id");
  if (!id) return { ok: false, status: 401, message: "Autentikasi diperlukan (x-persona-id)." };
  return { ok: true, persona: applyGrantedScope(getPersonaById(id), headers) };
}

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

/**
 * Authorization for the site-ranking endpoint. Cross-site ranking (comparing
 * multiple sites) is a Leader/Super Admin capability; a Site Admin may only
 * rank within their own single-site scope.
 */
export function authorizeRanking(
  persona: Persona,
  filter: { projectId?: string; locationId?: string; scope?: "tenant" | "executive" },
): AuthzResult {
  const base = authorizeDashboard(persona, filter);
  if (!base.ok) return base;

  const isCrossSite = filter.scope === "executive" || (!filter.locationId && persona.scope.locations.length !== 1);
  const canRankAcrossSites = persona.role === "super_admin" || persona.role === "leader_admin";
  if (isCrossSite && !canRankAcrossSites) {
    return { ok: false, status: 403, message: "Ranking lintas site hanya untuk Leader/Super Admin." };
  }
  return { ok: true };
}

/**
 * Authorization for the aggregate approval/activity timeline. Combines the base
 * dashboard scope checks (executive requires Leader/Super Admin; project and
 * location filters must be inside the persona's scope) with an explicit
 * cross-site guard: a site-scoped persona must target a specific project or
 * location they own and may never request the portfolio-wide timeline. Callers
 * still post-filter rows by `canAccessLocation` as defence in depth.
 */
export function authorizeTimeline(
  persona: Persona,
  filter: { projectId?: string; locationId?: string; scope?: "tenant" | "executive" },
): AuthzResult {
  const base = authorizeDashboard(persona, filter);
  if (!base.ok) return base;

  const isSiteScoped = persona.scope.locations.length > 0;
  const isCrossSite = filter.scope === "executive" || (!filter.projectId && !filter.locationId);
  if (isSiteScoped && isCrossSite) {
    return {
      ok: false,
      status: 403,
      message: "Timeline lintas site hanya untuk Leader/Super Admin — pilih site Anda.",
    };
  }
  return { ok: true };
}

/**
 * Authorization for SLA Approval Monitoring. Cross-site SLA monitoring (the
 * portfolio-wide compliance view) is a Leader/Super Admin capability; a
 * site-scoped Site Admin may only view the SLA status of a project or location
 * inside their own scope and must target a specific site. Callers still
 * post-filter rows by `canAccessLocation` as defence in depth.
 */
export function authorizeSla(
  persona: Persona,
  filter: { projectId?: string; locationId?: string; scope?: "tenant" | "executive" },
): AuthzResult {
  const base = authorizeDashboard(persona, filter);
  if (!base.ok) return base;

  const isSiteScoped = persona.scope.locations.length > 0;
  const isCrossSite = filter.scope === "executive" || (!filter.projectId && !filter.locationId);
  if (isSiteScoped && isCrossSite) {
    return {
      ok: false,
      status: 403,
      message: "Monitoring SLA lintas site hanya untuk Leader/Super Admin — pilih site Anda.",
    };
  }
  return { ok: true };
}
