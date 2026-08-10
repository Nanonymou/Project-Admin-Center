import { getCostCategories } from "@/lib/mock/cost-config";

/**
 * "Dana Cash" (petty-cash fund) ledger mock for the Daily Cost Dana Cash page.
 * Each site holds a cash fund; daily cost entries paid from cash draw the fund
 * down (top-ups replenish it). Config-driven — categories come from the shared
 * cost config keyed by project code. No database required.
 */

export type DanaCashEntry = {
  id: string;
  date: string; // ISO date
  categoryKey: string;
  categoryLabel: string;
  description: string;
  /** Positive for a top-up, negative for an expense. */
  amount: number;
  by: string;
};

function seeded(n: number): number {
  const x = Math.sin(n * 421.73) * 10000;
  return x - Math.floor(x);
}

/** Opening cash-fund balance for a location (deterministic per location id). */
export function danaCashOpeningBalance(locationId: string): number {
  let h = 0;
  for (let i = 0; i < locationId.length; i++) h = (h * 31 + locationId.charCodeAt(i)) & 0xffffffff;
  return 10_000_000 + (Math.abs(h) % 15) * 1_000_000;
}

const NAMES = ["Admin Site", "Kasir", "Leader Admin"];

/** Build a stable cash-fund ledger for one site over `days` days. */
export function buildDanaCashLedger(projectCode: string, locationId: string, days = 12): DanaCashEntry[] {
  const cats = getCostCategories(projectCode);
  const out: DanaCashEntry[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);

    // Every ~5th day, a top-up replenishes the fund.
    if (i > 0 && i % 5 === 0) {
      out.push({
        id: `dc-top-${locationId}-${i}`,
        date: iso,
        categoryKey: "top_up",
        categoryLabel: "Top-up Dana Cash",
        description: "Pengisian ulang kas",
        amount: 5_000_000 + Math.round(seeded(i + 1) * 5_000_000),
        by: "Leader Admin",
      });
    }

    const cat = cats[i % cats.length];
    out.push({
      id: `dc-exp-${locationId}-${i}`,
      date: iso,
      categoryKey: cat?.key ?? "misc",
      categoryLabel: cat?.label ?? "Pengeluaran",
      description: `Pengeluaran ${cat?.label ?? "harian"}`,
      amount: -(300_000 + Math.round(seeded(i + 2) * 2_700_000)),
      by: NAMES[i % NAMES.length],
    });
  }
  // Oldest first so the running balance reads top-to-bottom.
  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}
