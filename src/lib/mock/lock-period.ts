import type { SiteKpi } from "./site-kpi";

export type PeriodLockState = "open" | "locked";

export type PeriodLockRow = {
  id: string;
  locationId: string;
  locationName: string;
  projectCode: string;
  periodKey: string; // YYYY-MM
  periodLabel: string;
  state: PeriodLockState;
  lockedBy?: string;
  lockedAt?: string;
  salesTotal: number;
  costTotal: number;
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

/** Build recent monthly periods per site with a lock state. */
export function buildPeriodLocks(sites: SiteKpi[], months = 4): PeriodLockRow[] {
  const out: PeriodLockRow[] = [];
  for (const site of sites) {
    const seed = seedOf(site.locationId);
    for (let m = 0; m < months; m++) {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - m);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      // Past months locked, current month open.
      const locked = m > 0;
      out.push({
        id: `${site.locationId}-${key}`,
        locationId: site.locationId,
        locationName: site.locationName,
        projectCode: site.projectCode,
        periodKey: key,
        periodLabel: d.toLocaleDateString("id-ID", { month: "long", year: "numeric" }),
        state: locked ? "locked" : "open",
        lockedBy: locked ? (seed % 2 === 0 ? "Leader Admin" : "System") : undefined,
        lockedAt: locked
          ? new Date(d.getFullYear(), d.getMonth() + 1, 2).toLocaleDateString("id-ID", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })
          : undefined,
        salesTotal: Math.round((site.sales * (0.85 + rand(seed + m) * 0.3))),
        costTotal: Math.round((site.cost * (0.85 + rand(seed + m + 5) * 0.3))),
      });
    }
  }
  return out.sort((a, b) => (a.periodKey < b.periodKey ? 1 : a.periodKey > b.periodKey ? -1 : a.locationName.localeCompare(b.locationName)));
}
