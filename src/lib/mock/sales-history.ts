import { getServiceCategories } from "./service-config";
import { getPriceFor } from "./pricing-config";
import { getAreasFor } from "./area-config";
import { computeTax } from "@/lib/finance";
import type { ClosingState } from "./closing-status";
import type { SiteKpi } from "./site-kpi";

export type SalesHistoryEntry = {
  id: string;
  iso: string;
  dateLabel: string;
  locationId: string;
  locationName: string;
  projectCode: string;
  area: string;
  subtotal: number;
  tax: number;
  netInvoice: number;
  topCategory: string;
  lineCount: number;
  state: ClosingState;
};

const STATES: ClosingState[] = ["submitted", "reviewed", "approved", "locked"];

function seedOf(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffffffff;
  return Math.abs(h);
}
function rand(n: number) {
  const x = Math.sin(n) * 10000;
  return x - Math.floor(x);
}

/** Build ~30 days of Daily Sales entries for the given sites. */
export function buildSalesHistory(sites: SiteKpi[], days = 30): SalesHistoryEntry[] {
  const out: SalesHistoryEntry[] = [];
  for (const site of sites) {
    const cats = getServiceCategories(site.projectCode);
    const areas = getAreasFor(site.locationId, site.locationName);
    const baseDaily = site.sales / 30;
    for (let i = 1; i <= days; i++) {
      const seed = seedOf(site.locationId) + i;
      if (rand(seed) < 0.2) continue;
      const d = new Date();
      d.setDate(d.getDate() - i);
      const target = Math.round(baseDaily * (0.7 + rand(seed + 1) * 0.6));
      // distribute across categories by qty
      let subtotal = 0;
      let topCategory = cats[0]?.label ?? "-";
      let topVal = 0;
      let lineCount = 0;
      for (let ci = 0; ci < cats.length; ci++) {
        const price = getPriceFor(site.projectCode, site.locationId, cats[ci].key) || 1;
        const share = rand(seed + ci + 2);
        if (share < 0.3) continue;
        const qty = Math.max(1, Math.round(((target * share) / cats.length / price)));
        const val = qty * price;
        subtotal += val;
        lineCount++;
        if (val > topVal) {
          topVal = val;
          topCategory = cats[ci].label;
        }
      }
      const tax = computeTax(subtotal, site.projectCode);
      const stateIdx = i > 3 ? 3 : Math.floor(rand(seed + 9) * STATES.length);
      out.push({
        id: `${site.locationId}-${d.toISOString().slice(0, 10)}`,
        iso: d.toISOString().slice(0, 10),
        dateLabel: d.toLocaleDateString("id-ID", {
          weekday: "short",
          day: "2-digit",
          month: "short",
        }),
        locationId: site.locationId,
        locationName: site.locationName,
        projectCode: site.projectCode,
        area: areas[seed % areas.length]?.name ?? "-",
        subtotal,
        tax,
        netInvoice: subtotal + tax,
        topCategory,
        lineCount,
        state: STATES[Math.min(STATES.length - 1, stateIdx)],
      });
    }
  }
  return out.sort((a, b) => (a.iso < b.iso ? 1 : -1));
}
