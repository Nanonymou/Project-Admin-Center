/**
 * Sales areas (sub-locations) per location. Config-driven — each location
 * has its own set of serviceable areas (mess halls, camps, offices). A
 * mandatory area selection scopes each Daily Sales entry.
 */
export type SalesArea = {
  id: string;
  name: string;
};

const GENERIC_AREAS = ["Mess Hall A", "Mess Hall B", "Office Camp", "Workshop", "Main Camp"];

function seedOf(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffffffff;
  return Math.abs(h);
}

export function getAreasFor(locationId: string, locationName: string): SalesArea[] {
  const seed = seedOf(locationId);
  const count = 3 + (seed % 3); // 3..5 areas
  return Array.from({ length: count }, (_, i) => ({
    id: `${locationId}-area-${i}`,
    name: `${locationName} — ${GENERIC_AREAS[i % GENERIC_AREAS.length]}`,
  }));
}
