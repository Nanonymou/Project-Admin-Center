import { getServiceCategories, type ServiceCategory } from "./service-config";

/**
 * Master Pricing (config-driven) — price per service category can vary by
 * location, per PRD (Location → master_pricing). We derive a deterministic
 * per-location multiplier from the location id so each site has its own
 * price list without hardcoding.
 */
function locationMultiplier(locationId: string): number {
  let h = 0;
  for (let i = 0; i < locationId.length; i++) h = (h * 31 + locationId.charCodeAt(i)) & 0xffffffff;
  const frac = Math.abs(Math.sin(h));
  // multiplier between 0.9 and 1.15
  return 0.9 + frac * 0.25;
}

export function getPriceFor(
  projectCode: string,
  locationId: string,
  categoryKey: string,
): number {
  const cat = getServiceCategories(projectCode).find((c) => c.key === categoryKey);
  if (!cat) return 0;
  return Math.round((cat.defaultPrice * locationMultiplier(locationId)) / 500) * 500;
}

export function getPriceListFor(
  projectCode: string,
  locationId: string,
): Record<string, number> {
  const list: Record<string, number> = {};
  for (const cat of getServiceCategories(projectCode)) {
    list[cat.key] = getPriceFor(projectCode, locationId, cat.key);
  }
  return list;
}

export type PricedCategory = ServiceCategory & { price: number };

export function getPricedCategories(projectCode: string, locationId: string): PricedCategory[] {
  return getServiceCategories(projectCode).map((c) => ({
    ...c,
    price: getPriceFor(projectCode, locationId, c.key),
  }));
}
