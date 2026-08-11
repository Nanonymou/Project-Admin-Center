import type { Persona } from "@/lib/personas";
import { canAccessLocation, canAccessProject } from "@/lib/personas";

/**
 * Site-scope data filter (Hak Akses / RBAC). Defense-in-depth for list endpoints:
 * even after the middleware validates an explicit project/location filter, a
 * handler that returns multi-site rows must drop any row outside the caller's
 * scope — a Site Admin querying without a location filter should still only see
 * their own site's rows. These pure helpers keep that logic in one place.
 */

/** Filter rows to those whose project code is within the persona's scope. */
export function filterByProjectScope<T>(
  persona: Persona,
  rows: T[],
  projectOf: (row: T) => string,
): T[] {
  if (persona.scope.projects.length === 0) return rows;
  return rows.filter((r) => canAccessProject(persona, projectOf(r)));
}

/**
 * Filter rows to those whose (project, location) pair is within the persona's
 * scope. Both accessors are required so the project guard runs before the
 * location guard (a location is only meaningful inside an accessible project).
 */
export function filterByLocationScope<T>(
  persona: Persona,
  rows: T[],
  keyOf: (row: T) => { projectCode: string; locationId: string },
): T[] {
  if (persona.scope.projects.length === 0 && persona.scope.locations.length === 0) return rows;
  return rows.filter((r) => {
    const { projectCode, locationId } = keyOf(r);
    return canAccessLocation(persona, locationId, projectCode);
  });
}
