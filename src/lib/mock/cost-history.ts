import { getCostCategories } from "./cost-config";
import type { ClosingState } from "./closing-status";
import type { SiteKpi } from "./site-kpi";

export type CostHistoryEntry = {
  id: string;
  iso: string;
  dateLabel: string;
  locationId: string;
  locationName: string;
  projectCode: string;
  total: number;
  breakdown: { label: string; amount: number }[];
  state: ClosingState;
  submittedBy: string;
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

/**
 * Build ~30 days of Daily Cost submission history for a set of sites.
 */
export function buildCostHistory(sites: SiteKpi[], days = 30): CostHistoryEntry[] {
  const out: CostHistoryEntry[] = [];
  for (const site of sites) {
    const cats = getCostCategories(site.projectCode);
    const baseDaily = site.cost / 30;
    const owner =
      site.projectCode === "BUMA"
        ? "Bagas Wicaksono"
        : site.projectCode === "POMALA"
          ? "Ika Rahmawati"
          : site.projectCode === "PHSS"
            ? "Fajar Nugraha"
            : "Dinda Ayu";
    for (let i = 1; i <= days; i++) {
      const seed = seedOf(site.locationId) + i;
      if (rand(seed) < 0.25) continue; // some days not submitted
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayTotal = Math.round(baseDaily * (0.7 + rand(seed + 1) * 0.6));
      const weights = cats.map((_, idx) => 1 + rand(seed + idx + 2) * 3);
      const weightSum = weights.reduce((a, b) => a + b, 0);
      const breakdown = cats.map((c, idx) => ({
        label: c.label,
        amount: Math.round((weights[idx] / weightSum) * dayTotal),
      }));
      const stateIdx = i > 3 ? 3 : Math.floor(rand(seed + 9) * STATES.length);
      out.push({
        id: `${site.locationId}-${d.toISOString().slice(0, 10)}`,
        iso: d.toISOString().slice(0, 10),
        dateLabel: d.toLocaleDateString("id-ID", {
          weekday: "short",
          day: "2-digit",
          month: "short",
          year: "numeric",
        }),
        locationId: site.locationId,
        locationName: site.locationName,
        projectCode: site.projectCode,
        total: breakdown.reduce((s, b) => s + b.amount, 0),
        breakdown,
        state: STATES[Math.min(STATES.length - 1, stateIdx)],
        submittedBy: owner,
      });
    }
  }
  return out.sort((a, b) => (a.iso < b.iso ? 1 : -1));
}
