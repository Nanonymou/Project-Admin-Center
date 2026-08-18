import { MOCK_WORKSPACES } from "@/lib/mock/workspaces";

/**
 * The sites a Super Admin can grant per account. Derived from the workspace
 * catalogue so it always matches the app's real locations.
 */
export const ASSIGNABLE_SITES: { locationId: string; locationName: string; projectCode: string }[] =
  MOCK_WORKSPACES.map((w) => ({
    locationId: w.locationId,
    locationName: w.locationName,
    projectCode: w.projectCode,
  }));

const VALID_LOCATION_IDS = new Set(ASSIGNABLE_SITES.map((s) => s.locationId));

/** Keep only known locationIds (guards against tampered input). */
export function sanitizeLocationIds(ids: string[]): string[] {
  return Array.from(new Set(ids.filter((id) => VALID_LOCATION_IDS.has(id))));
}

/** The distinct projects covered by a set of granted locationIds. */
export function projectsForLocations(locationIds: string[]): string[] {
  const set = new Set<string>();
  for (const s of ASSIGNABLE_SITES) if (locationIds.includes(s.locationId)) set.add(s.projectCode);
  return Array.from(set);
}
