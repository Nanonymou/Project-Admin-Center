import { getAreasFor } from "./area-config";
import { getServiceCategories } from "./service-config";
import { getPriceFor } from "./pricing-config";
import type { SiteKpi } from "./site-kpi";

export type AreaSalesRow = {
  areaId: string;
  areaName: string;
  categories: { label: string; qty: number; amount: number }[];
  total: number;
};

function seedOf(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffffffff;
  return Math.abs(h);
}
function rand(n: number) {
  const x = Math.sin(n) * 10000;
  return x - Math.floor(x);
}

/** Build a sales breakdown per area × category for a site. */
export function buildAreaSales(site: SiteKpi): AreaSalesRow[] {
  const areas = getAreasFor(site.locationId, site.locationName);
  const cats = getServiceCategories(site.projectCode);
  const dailyTarget = site.sales / 30;

  return areas.map((area) => {
    let total = 0;
    const categories = cats.map((c, ci) => {
      const price = getPriceFor(site.projectCode, site.locationId, c.key) || 1;
      const seed = seedOf(area.id) + ci;
      const share = 0.2 + rand(seed) * 0.8;
      const qty = Math.max(0, Math.round(((dailyTarget * share) / areas.length / price)));
      const amount = qty * price;
      total += amount;
      return { label: c.label, qty, amount };
    });
    return { areaId: area.id, areaName: area.name, categories, total };
  });
}
